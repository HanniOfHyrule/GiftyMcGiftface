import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { BirthdayService } from '../birthday/birthday.service';
import { getJwtSecret } from '../auth/jwt-secrets';
import { TodoistConnection } from './entities/todoist-connection.entity';
import { TodoistTask } from './entities/todoist-task.entity';
import { decryptToken, encryptToken } from './token-crypto';
import {
  TodoistApiError,
  TodoistOAuthConfig,
  todoistApi,
  todoistOAuth,
} from './todoist-client';
import { planBirthdayTasks } from './birthday-tasks';
import { UpdateTodoistSettingsDto } from './dto/update-todoist-settings.dto';
import {
  todoistDisconnectionsTotal,
  todoistSyncsTotal,
  todoistTasksCreatedTotal,
} from '../metrics/metrics';

const PROJECT_NAME = 'Gifty McGiftface';
const STATE_PURPOSE = 'todoist-oauth';
// Token etwas vor Ablauf erneuern
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export interface TodoistStatus {
  configured: boolean;
  connected: boolean;
  presentLeadDays: number;
  cardLeadDays: number;
  whatsappLeadDays: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

export interface SyncResult {
  created: number;
  skipped: number;
  failed: number;
}

// Auslöser eines Syncs, nur für die Metriken
export type SyncTrigger = 'cron' | 'manual' | 'connect';

@Injectable()
export class TodoistService {
  private readonly logger = new Logger(TodoistService.name);
  private readonly runningSyncs = new Set<number>();

  constructor(
    @InjectRepository(TodoistConnection)
    private readonly connections: Repository<TodoistConnection>,
    @InjectRepository(TodoistTask)
    private readonly tasks: Repository<TodoistTask>,
    private readonly birthdayService: BirthdayService,
  ) {}

  // --- Konfiguration & Status -------------------------------------------

  private config(): TodoistOAuthConfig | null {
    const clientId = process.env.TODOIST_CLIENT_ID;
    const clientSecret = process.env.TODOIST_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return {
      clientId,
      clientSecret,
      redirectUri:
        process.env.TODOIST_REDIRECT_URI || `${appUrl}/api/todoist/callback`,
    };
  }

  private requireConfig(): TodoistOAuthConfig {
    const config = this.config();
    if (!config) {
      throw new ServiceUnavailableException(
        'Todoist ist nicht konfiguriert (TODOIST_CLIENT_ID / TODOIST_CLIENT_SECRET fehlen).',
      );
    }
    return config;
  }

  appUrl(): string {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  }

  async getStatus(userId: number): Promise<TodoistStatus> {
    const connection = await this.connections.findOne({ where: { userId } });
    return {
      configured: this.config() !== null,
      connected: connection !== null,
      presentLeadDays: connection?.presentLeadDays ?? 7,
      cardLeadDays: connection?.cardLeadDays ?? 5,
      whatsappLeadDays: connection?.whatsappLeadDays ?? 0,
      lastSyncAt: connection?.lastSyncAt ?? null,
      lastError: connection?.lastError ?? null,
    };
  }

  // --- OAuth ---------------------------------------------------------------

  createAuthorizationUrl(userId: number): string {
    const config = this.requireConfig();
    // Der signierte, kurzlebige State verknüpft den Callback mit dem User
    const state = jwt.sign(
      { sub: userId, purpose: STATE_PURPOSE },
      getJwtSecret(),
      {
        expiresIn: '10m',
      },
    );
    return todoistOAuth.authorizationUrl(config, state);
  }

  private userIdFromState(state: string): number {
    try {
      const payload = jwt.verify(state, getJwtSecret());
      if (
        typeof payload === 'object' &&
        payload.purpose === STATE_PURPOSE &&
        typeof payload.sub === 'number'
      ) {
        return payload.sub;
      }
    } catch {
      // ungültig oder abgelaufen
    }
    throw new BadRequestException('Ungültiger oder abgelaufener OAuth-State');
  }

  async handleCallback(code: string, state: string): Promise<number> {
    const config = this.requireConfig();
    const userId = this.userIdFromState(state);
    const tokens = await todoistOAuth.exchangeCode(config, code);

    const existing = await this.connections.findOne({ where: { userId } });
    await this.connections.save({
      ...(existing ?? { userId }),
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expiresAt: tokens.expiresAt,
      lastError: null,
    });

    // Erste Synchronisation direkt nach dem Verbinden
    await this.syncUser(userId, 'connect').catch((error: unknown) =>
      this.logger.warn(`Erster Todoist-Sync fehlgeschlagen: ${String(error)}`),
    );
    return userId;
  }

  async disconnect(userId: number): Promise<void> {
    const connection = await this.connections.findOne({ where: { userId } });
    if (!connection) return;

    const config = this.config();
    if (config) {
      await todoistOAuth
        .revoke(config, decryptToken(connection.accessToken))
        .catch((error: unknown) =>
          this.logger.warn(
            `Todoist-Token konnte nicht widerrufen werden: ${String(error)}`,
          ),
        );
    }
    await this.tasks.delete({ userId });
    await this.connections.delete({ userId });
    todoistDisconnectionsTotal.inc();
  }

  async updateSettings(
    userId: number,
    dto: UpdateTodoistSettingsDto,
  ): Promise<TodoistStatus> {
    const connection = await this.connections.findOne({ where: { userId } });
    if (!connection) throw new NotFoundException('Todoist ist nicht verbunden');
    Object.assign(connection, dto);
    await this.connections.save(connection);
    return this.getStatus(userId);
  }

  // --- Synchronisation -----------------------------------------------------

  @Cron('0 6 * * *', { name: 'todoist-sync', timeZone: 'Europe/Berlin' })
  async syncAll(): Promise<void> {
    if (!this.config()) return;
    const all = await this.connections.find({ select: { userId: true } });
    for (const { userId } of all) {
      await this.syncUser(userId, 'cron').catch((error: unknown) =>
        this.logger.error(
          `Todoist-Sync für User ${userId} fehlgeschlagen`,
          String(error),
        ),
      );
    }
  }

  async syncUser(userId: number, trigger: SyncTrigger): Promise<SyncResult> {
    const config = this.requireConfig();
    if (this.runningSyncs.has(userId)) {
      throw new BadRequestException('Synchronisation läuft bereits');
    }
    this.runningSyncs.add(userId);

    const connection = await this.connections.findOne({ where: { userId } });
    if (!connection) {
      this.runningSyncs.delete(userId);
      throw new NotFoundException('Todoist ist nicht verbunden');
    }

    try {
      const accessToken = await this.validAccessToken(config, connection);
      const projectId = await this.ensureProject(connection, accessToken);
      const result = await this.createDueTasks(
        userId,
        connection,
        accessToken,
        projectId,
      );

      connection.lastSyncAt = new Date();
      connection.lastError =
        result.failed > 0
          ? `${result.failed} Aufgabe(n) konnten nicht angelegt werden`
          : null;
      await this.connections.save(connection);
      todoistSyncsTotal.inc({ trigger, result: 'success' });
      return result;
    } catch (error) {
      todoistSyncsTotal.inc({ trigger, result: 'error' });
      connection.lastSyncAt = new Date();
      connection.lastError = this.describeError(error);
      await this.connections.save(connection);
      throw error;
    } finally {
      this.runningSyncs.delete(userId);
    }
  }

  private async createDueTasks(
    userId: number,
    connection: TodoistConnection,
    accessToken: string,
    projectId: string,
  ): Promise<SyncResult> {
    const birthdays = await this.birthdayService.findAll(userId);
    const planned = planBirthdayTasks(birthdays, connection);
    const result: SyncResult = { created: 0, skipped: 0, failed: 0 };
    if (planned.length === 0) return result;

    const existing = await this.tasks.find({
      where: { userId, birthdayId: In(planned.map((t) => t.birthdayId)) },
    });
    const done = new Set(existing.map((t) => `${t.birthdayId}:${t.year}`));

    for (const task of planned) {
      const key = `${task.birthdayId}:${task.year}`;
      if (done.has(key)) {
        result.skipped++;
        continue;
      }
      try {
        const created = await todoistApi.createTask(
          accessToken,
          { ...task, projectId },
          // Gleiche ID bei Wiederholung -> Todoist legt die Aufgabe nicht doppelt an
          this.requestId(`${userId}:${key}`),
        );
        await this.tasks.save({
          userId,
          birthdayId: task.birthdayId,
          year: task.year,
          todoistTaskId: created.id,
        });
        result.created++;
        todoistTasksCreatedTotal.inc({ result: 'created' });
      } catch (error) {
        result.failed++;
        todoistTasksCreatedTotal.inc({ result: 'failed' });
        this.logger.warn(
          `Todoist-Aufgabe für Geburtstag ${task.birthdayId} fehlgeschlagen: ${String(error)}`,
        );
        // Bei Auth-Problemen brauchen wir es für die restlichen gar nicht versuchen
        if (error instanceof TodoistApiError && error.status === 401)
          throw error;
      }
    }
    return result;
  }

  private async validAccessToken(
    config: TodoistOAuthConfig,
    connection: TodoistConnection,
  ): Promise<string> {
    const expiresSoon =
      connection.expiresAt !== null &&
      connection.expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;
    if (!expiresSoon) return decryptToken(connection.accessToken);

    if (!connection.refreshToken) {
      throw new TodoistApiError('Todoist-Zugang abgelaufen', 401);
    }
    const tokens = await todoistOAuth.refresh(
      config,
      decryptToken(connection.refreshToken),
    );
    connection.accessToken = encryptToken(tokens.accessToken);
    connection.refreshToken = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null;
    connection.expiresAt = tokens.expiresAt;
    await this.connections.save(connection);
    return tokens.accessToken;
  }

  private async ensureProject(
    connection: TodoistConnection,
    accessToken: string,
  ): Promise<string> {
    if (connection.projectId) {
      try {
        await todoistApi.getProject(accessToken, connection.projectId);
        return connection.projectId;
      } catch (error) {
        // Projekt wurde in Todoist gelöscht -> neu anlegen
        if (!(error instanceof TodoistApiError && error.status === 404)) {
          throw error;
        }
      }
    }
    const project = await todoistApi.createProject(accessToken, PROJECT_NAME);
    connection.projectId = project.id;
    await this.connections.save(connection);
    return project.id;
  }

  /** Deterministische UUID aus einem Schlüssel (für X-Request-Id) */
  private requestId(key: string): string {
    const h = createHash('sha256').update(`gifty:${key}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }

  private describeError(error: unknown): string {
    if (
      error instanceof TodoistApiError &&
      (error.status === 401 || error.status === 400)
    ) {
      return 'Todoist-Zugang abgelaufen oder widerrufen. Bitte neu verbinden.';
    }
    if (error instanceof Error) return error.message.slice(0, 300);
    return 'Unbekannter Fehler';
  }
}
