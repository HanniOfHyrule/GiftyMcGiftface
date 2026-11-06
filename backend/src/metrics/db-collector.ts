import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Gauge, register } from 'prom-client';

interface CountRow {
  count: string | number;
}

interface LabeledCountRow extends CountRow {
  label: string;
}

// Bestandszahlen direkt aus der Datenbank, bei jedem Scrape neu gezählt –
// statt sie in den Services mitzuführen. Das sind billige COUNTs auf kleinen
// Tabellen, und ein Gauge, der immer exakt stimmt, ist besser als einer, den
// ein Codepfad vergisst herunterzuzählen.
//
// Es verlassen nur aggregierte Zahlen die Datenbank – nie Namen, Daten oder
// E-Mail-Adressen.
@Injectable()
export class DbMetricsCollector implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbMetricsCollector.name);
  private readonly names: string[] = [];

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    this.count(
      'gifty_users',
      'Number of user accounts.',
      'SELECT COUNT(*) AS count FROM "user"',
    );
    this.countBy(
      'gifty_birthdays_by_todo',
      'Number of birthdays by todo type.',
      'todo',
      'SELECT "Todo" AS label, COUNT(*) AS count FROM birthdays GROUP BY "Todo"',
    );
    // full = mit Geburtsjahr, no_year = "--MM-DD", missing = kein Datum
    this.countBy(
      'gifty_birthdays_by_date_kind',
      'Number of birthdays by kind of date (full, no_year, missing).',
      'kind',
      `SELECT CASE
         WHEN "dateOfBirth" IS NULL OR "dateOfBirth" = '' THEN 'missing'
         WHEN "dateOfBirth" LIKE '--%' THEN 'no_year'
         ELSE 'full'
       END AS label, COUNT(*) AS count
       FROM birthdays GROUP BY 1`,
    );
    // Der Token entsteht, sobald ein User die Abo-URL einmal abruft – das
    // heißt nicht zwingend, dass ein Kalender ihn tatsächlich abonniert hat.
    this.count(
      'gifty_users_calendar_token',
      'Number of users who have generated a calendar feed URL.',
      'SELECT COUNT(*) AS count FROM "user" WHERE "calendarToken" IS NOT NULL',
    );
    this.count(
      'gifty_users_todoist_connected',
      'Number of users with a Todoist connection.',
      'SELECT COUNT(*) AS count FROM todoist_connections',
    );
    // Verbindungen, deren letzter Sync (ganz oder teilweise) fehlschlug –
    // z. B. widerrufene Tokens, die der tägliche Cron sonst still wiederholt.
    this.count(
      'gifty_todoist_connections_with_error',
      'Number of Todoist connections whose last sync reported an error.',
      'SELECT COUNT(*) AS count FROM todoist_connections WHERE "lastError" IS NOT NULL',
    );
  }

  // Erlaubt mehrere App-Instanzen nacheinander im selben Prozess (Tests),
  // ohne dass die Registry "already registered" wirft.
  onModuleDestroy(): void {
    for (const name of this.names) {
      register.removeSingleMetric(name);
    }
    this.names.length = 0;
  }

  // Schlägt eine Abfrage fehl, wird geloggt und nur dieser Gauge bleibt auf
  // dem letzten Wert – eine kurz nicht erreichbare Datenbank darf nicht den
  // ganzen /metrics-Scrape (und damit alle Zähler) mitreißen.
  private count(name: string, help: string, sql: string): void {
    const query = (): Promise<CountRow[]> => this.dataSource.query(sql);
    const logger = this.logger;
    this.names.push(name);
    new Gauge({
      name,
      help,
      async collect() {
        try {
          const [row] = await query();
          this.set(Number(row?.count ?? 0));
        } catch (error) {
          logger.warn(`${name}: ${String(error)}`);
        }
      },
    });
  }

  private countBy(
    name: string,
    help: string,
    labelName: string,
    sql: string,
  ): void {
    const query = (): Promise<LabeledCountRow[]> => this.dataSource.query(sql);
    const logger = this.logger;
    this.names.push(name);
    new Gauge({
      name,
      help,
      labelNames: [labelName],
      async collect() {
        try {
          const rows = await query();
          // Zurücksetzen, damit verschwundene Label-Werte nicht stehen bleiben
          this.reset();
          for (const row of rows) {
            this.set({ [labelName]: row.label }, Number(row.count));
          }
        } catch (error) {
          logger.warn(`${name}: ${String(error)}`);
        }
      },
    });
  }
}
