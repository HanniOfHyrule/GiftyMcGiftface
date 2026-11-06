/**
 * Importiert Geburtstage aus einer CSV-Datei in die Postgres-Datenbank
 * und ordnet sie einem bestehenden User zu.
 *
 * Aufruf (im Ordner backend/):
 *   pnpm import-csv <email> [pfad/zur/datei.csv]
 *
 * CSV-Spalten: "First Name", "Last Name", "Birthday"
 * Birthday im Format YYYY-MM-DD oder --MM-DD (ohne Jahr).
 */
import './src/load-env';
import * as fs from 'fs';
import * as path from 'path';
// csv-parser ist ein CommonJS-Modul (`export =`), ohne esModuleInterop nur so typsicher importierbar
// eslint-disable-next-line @typescript-eslint/no-require-imports
import csv = require('csv-parser');
import { DataSource } from 'typeorm';
import { Birthday, TodoType } from './src/birthday/entities/birthday.entity';
import { User } from './src/user/entities/user.entity';

type CsvRow = Record<string, string | undefined>;

const DATE_PATTERN = /^(\d{4}|-)-\d{2}-\d{2}$/;

async function main(): Promise<void> {
  const [email, csvArg] = process.argv.slice(2);
  if (!email) {
    console.error('Aufruf: pnpm import-csv <email> [pfad/zur/datei.csv]');
    process.exit(1);
  }

  const csvPath = path.resolve(
    csvArg ?? path.join('src', 'data', 'contacts_min.csv'),
  );
  if (!fs.existsSync(csvPath)) {
    console.error('CSV nicht gefunden:', csvPath);
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 5433,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [Birthday, User],
  });
  await dataSource.initialize();

  try {
    const user = await dataSource
      .getRepository(User)
      .findOne({ where: { email } });
    if (!user) {
      console.error(`Kein User mit der E-Mail ${email} gefunden.`);
      process.exitCode = 1;
      return;
    }

    const rows = await new Promise<CsvRow[]>((resolve, reject) => {
      const results: CsvRow[] = [];
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row: CsvRow) => results.push(row))
        .on('end', () => resolve(results))
        .on('error', reject);
    });

    const birthdayRepo = dataSource.getRepository(Birthday);
    let imported = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const name = (row['First Name'] ?? '').trim();
      const lastName = (row['Last Name'] ?? '').trim();
      const dob = (row['Birthday'] ?? '').trim();
      const label = `Zeile ${index + 2} (${name} ${lastName})`.trim();

      if (!name && !lastName) {
        console.warn(`Übersprungen: Zeile ${index + 2} hat keinen Namen`);
        skipped++;
        continue;
      }
      if (!DATE_PATTERN.test(dob)) {
        console.warn(`Übersprungen: ${label} - ungültiges Datum "${dob}"`);
        skipped++;
        continue;
      }

      const existing = await birthdayRepo.findOne({
        where: { name, lastName, user: { id: user.id } },
      });
      if (existing) {
        console.log(`Übersprungen: ${label} - existiert bereits`);
        skipped++;
        continue;
      }

      await birthdayRepo.save(
        birthdayRepo.create({
          name,
          lastName,
          dateOfBirth: dob,
          Todo: TodoType.NEEDPRESENT,
          user,
        }),
      );
      imported++;
    }

    console.log(
      `\nFertig: ${imported} importiert, ${skipped} übersprungen (${rows.length} Zeilen).`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error('Import fehlgeschlagen:', e);
  process.exit(1);
});
