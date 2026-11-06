import { readFileSync } from 'fs';
import type { TlsOptions } from 'tls';

// TLS zur Datenbank: Ist DATABASE_SSL_CA gesetzt (Pfad zur CA-Datei der
// Datenbank), wird verschlüsselt verbunden und das
// Server-Zertifikat gegen diese CA geprüft. Ohne die Variable (lokal, Docker
// Compose) bleibt die Verbindung unverschlüsselt.
export function databaseSslOptions(
  env: NodeJS.ProcessEnv = process.env,
): TlsOptions | false {
  const caPath = env.DATABASE_SSL_CA;
  if (!caPath) {
    return false;
  }
  return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
}
