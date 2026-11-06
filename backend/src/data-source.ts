import './load-env';
import { DataSource } from 'typeorm';
import { databaseSslOptions } from './database/ssl-options';
import { InitialSchema1790797535550 } from './migrations/1790797535550-InitialSchema';
import { AddTodoistIntegration1790800932454 } from './migrations/1790800932454-AddTodoistIntegration';
import { AddBirthdaySharing1791468715000 } from './migrations/1791468715000-AddBirthdaySharing';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5433,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: databaseSslOptions(),
  entities: [__dirname + '/**/*.entity.{js,ts}'],
  // Schemaänderungen nur über Migrationen (pnpm migration:generate),
  // die beim Start automatisch ausgeführt werden.
  synchronize: false,
  migrations: [
    InitialSchema1790797535550,
    AddTodoistIntegration1790800932454,
    AddBirthdaySharing1791468715000,
  ],
  migrationsRun: true,
  logging: false,
});
