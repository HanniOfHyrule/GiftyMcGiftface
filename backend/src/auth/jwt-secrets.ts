const MIN_SECRET_LENGTH = 32;

// Ohne Secret darf das Backend nicht starten, sonst ließen sich Tokens fälschen.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET muss gesetzt und mindestens ${MIN_SECRET_LENGTH} Zeichen lang sein ` +
        `(aktuell: ${secret ? `${secret.length} Zeichen` : 'nicht gesetzt'}). ` +
        'Hinweis: Eine im Terminal gesetzte Variable hat Vorrang vor der .env.',
    );
  }
  return secret;
}

export function getJwtRefreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || getJwtSecret();
}
