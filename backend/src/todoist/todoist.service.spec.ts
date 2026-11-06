import * as jwt from 'jsonwebtoken';

// @nestjs/schedule wird als ES-Modul ausgeliefert, das Jest (CommonJS) nicht laden kann;
// der Cron-Decorator ist für diese Tests irrelevant.
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));
import { TodoType } from '../birthday/entities/birthday.entity';
import { BirthdayService } from '../birthday/birthday.service';
import { TodoistService } from './todoist.service';
import { TodoistConnection } from './entities/todoist-connection.entity';
import { TodoistTask } from './entities/todoist-task.entity';
import { decryptToken } from './token-crypto';
import {
  todoistDisconnectionsTotal,
  todoistSyncsTotal,
  todoistTasksCreatedTotal,
} from '../metrics/metrics';
import { metricValue } from '../metrics/testing';

// Minimaler In-Memory-Ersatz für die TypeORM-Repositories
function fakeRepo<T extends { id?: number }>() {
  let rows: T[] = [];
  let nextId = 1;
  const matches = (row: T, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      const value = (row as Record<string, unknown>)[k];
      if (v && typeof v === 'object' && '_value' in v) {
        return (v as { _value: unknown[] })._value.includes(value);
      }
      return value === v;
    });
  return {
    rows: () => rows,
    findOne: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
    ),
    find: jest.fn((opts?: { where?: Record<string, unknown> }) =>
      Promise.resolve(
        opts?.where ? rows.filter((r) => matches(r, opts.where!)) : rows,
      ),
    ),
    save: jest.fn((entity: T) => {
      if (!entity.id) {
        entity = { ...entity, id: nextId++ };
        rows.push(entity);
      } else {
        rows = rows.map((r) => (r.id === entity.id ? entity : r));
      }
      return Promise.resolve(entity);
    }),
    delete: jest.fn((where: Record<string, unknown>) => {
      rows = rows.filter((r) => !matches(r, where));
      return Promise.resolve({ affected: 1 });
    }),
  };
}

type Call = { url: string; method: string; body: Record<string, unknown> };

describe('TodoistService', () => {
  let service: TodoistService;
  let connections: ReturnType<typeof fakeRepo<TodoistConnection>>;
  let tasks: ReturnType<typeof fakeRepo<TodoistTask>>;
  let calls: Call[];
  let projectExists: boolean;
  let taskCounter: number;
  // HTTP-Status, mit dem das Anlegen von Aufgaben scheitert (null = klappt)
  let taskFailureStatus: number | null;

  const today = new Date();
  const inDays = (n: number) => {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + n,
    );
    return `1990-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const birthdays = [
    {
      id: 1,
      name: 'Anna',
      lastName: 'A',
      dateOfBirth: inDays(10),
      Todo: TodoType.NEEDPRESENT,
    },
    {
      id: 2,
      name: 'Ben',
      lastName: 'B',
      dateOfBirth: inDays(3),
      Todo: TodoType.WHATSAPP,
    },
    {
      id: 3,
      name: 'Cleo',
      lastName: 'C',
      dateOfBirth: inDays(100),
      Todo: TodoType.NEEDCARD,
    },
  ];

  const respond = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.TODOIST_CLIENT_ID = 'client-id';
    process.env.TODOIST_CLIENT_SECRET = 'client-secret';
    process.env.APP_URL = 'https://gifty.example.com';

    connections = fakeRepo<TodoistConnection>();
    tasks = fakeRepo<TodoistTask>();
    calls = [];
    projectExists = true;
    taskCounter = 0;
    taskFailureStatus = null;

    jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : {};
      calls.push({ url, method, body });

      if (url.endsWith('/oauth/access_token')) {
        return respond(200, {
          access_token:
            body.grant_type === 'refresh_token' ? 'access-2' : 'access-1',
          refresh_token:
            body.grant_type === 'refresh_token' ? 'refresh-2' : 'refresh-1',
          expires_in: 3600,
        });
      }
      if (url.endsWith('/projects') && method === 'POST') {
        projectExists = true;
        return respond(200, { id: 'proj-1', name: body.name });
      }
      if (url.includes('/projects/')) {
        return projectExists
          ? respond(200, { id: 'proj-1', name: 'x' })
          : respond(404, {});
      }
      if (url.endsWith('/tasks') && method === 'POST') {
        if (taskFailureStatus !== null) return respond(taskFailureStatus, {});
        return respond(200, { id: `task-${++taskCounter}` });
      }
      return respond(500, {});
    });

    const birthdayService = {
      findAll: jest.fn().mockResolvedValue(birthdays),
    } as unknown as BirthdayService;
    service = new TodoistService(
      connections as never,
      tasks as never,
      birthdayService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  const connect = async () => {
    const url = new URL(service.createAuthorizationUrl(42));
    return service.handleCallback('auth-code', url.searchParams.get('state')!);
  };

  it('baut die Autorisierungs-URL mit Redirect auf APP_URL', () => {
    const url = new URL(service.createAuthorizationUrl(42));
    expect(url.origin + url.pathname).toBe(
      'https://todoist.com/oauth/authorize',
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('scope')).toBe('data:read_write');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://gifty.example.com/api/todoist/callback',
    );
  });

  it('verbindet, legt Projekt und fällige Aufgaben an und speichert Tokens verschlüsselt', async () => {
    await expect(connect()).resolves.toBe(42);

    const [connection] = connections.rows();
    expect(connection.userId).toBe(42);
    expect(connection.accessToken).not.toBe('access-1');
    expect(decryptToken(connection.accessToken)).toBe('access-1');
    expect(connection.projectId).toBe('proj-1');

    const created = calls.filter((c) => c.url.endsWith('/tasks'));
    // Cleo (100 Tage entfernt) liegt außerhalb des Horizonts
    expect(created.map((c) => c.body.content)).toEqual([
      '🎁 Geschenk für Anna A besorgen',
      '💬 Ben B zum Geburtstag gratulieren',
    ]);
    expect(created.every((c) => c.body.project_id === 'proj-1')).toBe(true);
    expect(tasks.rows()).toHaveLength(2);
  });

  it('legt beim zweiten Sync keine Duplikate an', async () => {
    await connect();
    const result = await service.syncUser(42, 'manual');
    expect(result).toEqual({ created: 0, skipped: 2, failed: 0 });
    expect(calls.filter((c) => c.url.endsWith('/tasks'))).toHaveLength(2);
  });

  it('legt geteilte Geburtstage auch an, wenn der Besitzer schon eine Aufgabe dafür hat', async () => {
    const yearIn = (n: number) =>
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + n,
      ).getFullYear();
    // Besitzer (User 7) hat Annas und Bens Aufgabe bereits in seinem Todoist
    await tasks.save({ userId: 7, birthdayId: 1, year: yearIn(10) } as never);
    await tasks.save({ userId: 7, birthdayId: 2, year: yearIn(3) } as never);

    await connect();

    expect(calls.filter((c) => c.url.endsWith('/tasks'))).toHaveLength(2);
    expect(tasks.rows().filter((t) => t.userId === 42)).toHaveLength(2);
  });

  it('erneuert einen abgelaufenen Access-Token per Refresh-Token', async () => {
    await connect();
    connections.rows()[0].expiresAt = new Date(Date.now() - 1000);
    await service.syncUser(42, 'manual');

    const refresh = calls.find((c) => c.body.grant_type === 'refresh_token');
    expect(refresh?.body.refresh_token).toBe('refresh-1');
    expect(decryptToken(connections.rows()[0].accessToken)).toBe('access-2');
    expect(decryptToken(connections.rows()[0].refreshToken!)).toBe('refresh-2');
  });

  it('legt das Projekt neu an, wenn es in Todoist gelöscht wurde', async () => {
    await connect();
    projectExists = false;
    tasks.rows().length = 0;
    await service.syncUser(42, 'manual');
    expect(
      calls.filter((c) => c.url.endsWith('/projects') && c.method === 'POST'),
    ).toHaveLength(2);
  });

  it('lehnt einen gefälschten oder fremden State ab', async () => {
    const forged = jwt.sign(
      { sub: 42, purpose: 'todoist-oauth' },
      'y'.repeat(32),
    );
    await expect(service.handleCallback('code', forged)).rejects.toThrow(
      'Ungültiger oder abgelaufener OAuth-State',
    );
    const wrongPurpose = jwt.sign({ sub: 42 }, process.env.JWT_SECRET!);
    await expect(
      service.handleCallback('code', wrongPurpose),
    ).rejects.toThrow();
    expect(connections.rows()).toHaveLength(0);
  });

  describe('Metriken', () => {
    const syncs = (trigger: string, result: string) =>
      metricValue(todoistSyncsTotal, { trigger, result });
    const tasksCreated = (result: string) =>
      metricValue(todoistTasksCreatedTotal, { result });

    it('zählt den ersten Sync beim Verbinden und die angelegten Aufgaben', async () => {
      const syncsBefore = await syncs('connect', 'success');
      const createdBefore = await tasksCreated('created');
      await connect();
      expect((await syncs('connect', 'success')) - syncsBefore).toBe(1);
      expect((await tasksCreated('created')) - createdBefore).toBe(2);
    });

    it('zählt einzeln gescheiterte Aufgaben, der Sync selbst gilt als erfolgreich', async () => {
      await connect();
      tasks.rows().length = 0;
      taskFailureStatus = 500;
      const syncsBefore = await syncs('manual', 'success');
      const failedBefore = await tasksCreated('failed');
      await service.syncUser(42, 'manual');
      expect((await syncs('manual', 'success')) - syncsBefore).toBe(1);
      expect((await tasksCreated('failed')) - failedBefore).toBe(2);
    });

    it('zählt einen abgebrochenen Sync als Fehler', async () => {
      await connect();
      tasks.rows().length = 0;
      taskFailureStatus = 401;
      const before = await syncs('cron', 'error');
      await expect(service.syncUser(42, 'cron')).rejects.toThrow();
      expect((await syncs('cron', 'error')) - before).toBe(1);
    });

    it('zählt Trennen nur, wenn eine Verbindung bestand', async () => {
      const before = await metricValue(todoistDisconnectionsTotal);
      await service.disconnect(42);
      expect(await metricValue(todoistDisconnectionsTotal)).toBe(before);
      await connect();
      await service.disconnect(42);
      expect(await metricValue(todoistDisconnectionsTotal)).toBe(before + 1);
    });
  });

  it('meldet "nicht konfiguriert" ohne Client-ID', async () => {
    delete process.env.TODOIST_CLIENT_ID;
    await expect(service.getStatus(42)).resolves.toMatchObject({
      configured: false,
      connected: false,
    });
  });
});
