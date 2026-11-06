import { register } from 'prom-client';
import { DataSource } from 'typeorm';
import { DbMetricsCollector } from './db-collector';

describe('DbMetricsCollector', () => {
  let query: jest.Mock;
  let collector: DbMetricsCollector;

  // Antwortet je nach SQL wie die echte Datenbank
  const answer = (sql: string) => {
    if (sql.includes('GROUP BY "Todo"')) {
      return [
        { label: 'NEEDPRESENT', count: '5' },
        { label: 'WHATSAPP', count: '2' },
      ];
    }
    if (sql.includes('GROUP BY 1')) {
      return [
        { label: 'full', count: '4' },
        { label: 'no_year', count: '3' },
      ];
    }
    if (sql.includes('"calendarToken"')) return [{ count: '2' }];
    if (sql.includes('"lastError"')) return [{ count: '1' }];
    if (sql.includes('todoist_connections')) return [{ count: '3' }];
    if (sql.includes('FROM "user"')) return [{ count: '10' }];
    throw new Error(`unexpected query: ${sql}`);
  };

  beforeEach(() => {
    query = jest.fn((sql: string) => Promise.resolve(answer(sql)));
    collector = new DbMetricsCollector({ query } as unknown as DataSource);
    collector.onModuleInit();
  });

  afterEach(() => collector.onModuleDestroy());

  const scrape = () => register.metrics();

  it('reports the counts from the database', async () => {
    const text = await scrape();
    expect(text).toContain('gifty_users 10');
    expect(text).toContain('gifty_birthdays_by_todo{todo="NEEDPRESENT"} 5');
    expect(text).toContain('gifty_birthdays_by_todo{todo="WHATSAPP"} 2');
    expect(text).toContain('gifty_birthdays_by_date_kind{kind="full"} 4');
    expect(text).toContain('gifty_birthdays_by_date_kind{kind="no_year"} 3');
    expect(text).toContain('gifty_users_calendar_token 2');
    expect(text).toContain('gifty_users_todoist_connected 3');
    expect(text).toContain('gifty_todoist_connections_with_error 1');
  });

  it('drops label values that disappeared since the last scrape', async () => {
    await scrape();
    query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('GROUP BY "Todo"')
          ? [{ label: 'NEEDPRESENT', count: '5' }]
          : answer(sql),
      ),
    );
    const text = await scrape();
    expect(text).not.toContain('todo="WHATSAPP"');
  });

  it('keeps reporting the other gauges when one query fails', async () => {
    query.mockImplementation((sql: string) =>
      sql.includes('"lastError"')
        ? Promise.reject(new Error('db down'))
        : Promise.resolve(answer(sql)),
    );
    const text = await scrape();
    expect(text).toContain('gifty_users 10');
    expect(text).toContain('gifty_users_todoist_connected 3');
  });

  it('unregisters its gauges on shutdown so a new instance can register', () => {
    collector.onModuleDestroy();
    expect(register.getSingleMetric('gifty_users')).toBeUndefined();
    expect(() => collector.onModuleInit()).not.toThrow();
  });
});
