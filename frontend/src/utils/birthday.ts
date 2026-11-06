// Geburtstage werden als YYYY-MM-DD oder --MM-DD (ohne Jahr) gespeichert.

export const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export type BirthdayParts = {
  day: number | null;
  month: number | null; // 1-12
  year: number | null;
};

export function parseBirthday(value: string | null | undefined): BirthdayParts {
  const match = /^(\d{4}|-)-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return { day: null, month: null, year: null };
  return {
    year: match[1] === '-' ? null : Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** Leerer String, solange Tag oder Monat fehlen */
export function formatBirthdayValue({
  day,
  month,
  year,
}: BirthdayParts): string {
  if (!day || !month) return '';
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return year ? `${year}-${mm}-${dd}` : `--${mm}-${dd}`;
}

/** Anzahl Tage im Monat; ohne Jahr ist der 29. Februar erlaubt */
export function daysInMonth(month: number | null, year: number | null): number {
  if (!month) return 31;
  return new Date(year ?? 2000, month, 0).getDate();
}

/** z.B. "12. Mai 1990" oder "12. Mai" */
export function formatBirthdayLabel(value: string | null | undefined): string {
  const { day, month, year } = parseBirthday(value);
  if (!day || !month) return 'Kein Datum';
  return `${day}. ${MONTHS[month - 1]}${year ? ` ${year}` : ''}`;
}

/** Alter am nächsten Geburtstag, oder null ohne Jahr */
export function upcomingAge(
  parts: BirthdayParts,
  today: Date = new Date(),
): number | null {
  if (!parts.year || !parts.month || !parts.day) return null;
  const birthdayThisYear = new Date(
    today.getFullYear(),
    parts.month - 1,
    parts.day,
  );
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const nextYear =
    birthdayThisYear < startOfToday
      ? today.getFullYear() + 1
      : today.getFullYear();
  return nextYear - parts.year;
}
