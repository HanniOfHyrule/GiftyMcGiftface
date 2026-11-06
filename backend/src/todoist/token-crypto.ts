import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { getJwtSecret } from '../auth/jwt-secrets';

// Todoist-Tokens werden mit AES-256-GCM verschlüsselt gespeichert.
// Der Schlüssel wird aus TODOIST_ENCRYPTION_KEY abgeleitet (Fallback: JWT_SECRET).
// Ändert sich der Schlüssel, muss Todoist neu verbunden werden.
const key = () =>
  createHash('sha256')
    .update(`todoist:${process.env.TODOIST_ENCRYPTION_KEY || getJwtSecret()}`)
    .digest();

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString('base64'))
    .join('.');
}

export function decryptToken(stored: string): string {
  const [iv, tag, encrypted] = stored
    .split('.')
    .map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}
