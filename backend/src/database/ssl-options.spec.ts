import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { databaseSslOptions } from './ssl-options';

describe('databaseSslOptions', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gifty-ssl-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('ist ohne DATABASE_SSL_CA deaktiviert', () => {
    expect(databaseSslOptions({})).toBe(false);
  });

  it('prüft das Server-Zertifikat gegen die angegebene CA', () => {
    const caPath = join(dir, 'ca.crt');
    writeFileSync(caPath, 'CA-INHALT');

    expect(databaseSslOptions({ DATABASE_SSL_CA: caPath })).toEqual({
      ca: 'CA-INHALT',
      rejectUnauthorized: true,
    });
  });

  it('bricht ab, wenn die CA-Datei fehlt', () => {
    expect(() =>
      databaseSslOptions({ DATABASE_SSL_CA: join(dir, 'fehlt.crt') }),
    ).toThrow();
  });
});
