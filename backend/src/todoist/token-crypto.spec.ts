import { decryptToken, encryptToken } from './token-crypto';

describe('token-crypto', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'x'.repeat(32);
  });

  it('verschlüsselt und entschlüsselt einen Token', () => {
    const encrypted = encryptToken('geheimer-token');
    expect(encrypted).not.toContain('geheimer-token');
    expect(decryptToken(encrypted)).toBe('geheimer-token');
  });

  it('erzeugt bei jedem Aufruf einen anderen Ciphertext', () => {
    expect(encryptToken('abc')).not.toBe(encryptToken('abc'));
  });

  it('erkennt manipulierte Daten', () => {
    const [iv, tag, data] = encryptToken('abc').split('.');
    const tampered = [iv, tag, Buffer.from('xyz').toString('base64')].join('.');
    expect(() => decryptToken(tampered)).toThrow();
    expect(data).toBeTruthy();
  });
});
