import { TodoType } from '../birthday/entities/birthday.entity';

export interface LeadDays {
  presentLeadDays: number;
  cardLeadDays: number;
  whatsappLeadDays: number;
}

export interface BirthdayLike {
  id: number;
  name: string;
  lastName: string;
  dateOfBirth: string | null;
  Todo: TodoType;
}

export interface PlannedTask {
  birthdayId: number;
  /** Jahr des Geburtstags, für den die Aufgabe gilt */
  year: number;
  content: string;
  description: string;
  /** YYYY-MM-DD */
  dueDate: string;
}

/** Aufgaben für Geburtstage anlegen, die höchstens so viele Tage entfernt sind */
export const PLANNING_HORIZON_DAYS = 30;

const pad = (n: number) => String(n).padStart(2, '0');
const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY_MS = 24 * 60 * 60 * 1000;

/** Liefert Monat (1-12), Tag und ggf. Geburtsjahr aus YYYY-MM-DD oder --MM-DD */
function parseBirthday(
  dateOfBirth: string,
): { month: number; day: number; birthYear: number | null } | null {
  const match = /^(\d{4}|-)-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    month,
    day,
    birthYear: match[1] === '-' ? null : Number(match[1]),
  };
}

/** Geburtstag in einem Jahr; 29.02. wird in Nicht-Schaltjahren zum 28.02. */
function birthdayInYear(year: number, month: number, day: number): Date {
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return new Date(year, month, 0);
  return date;
}

function leadDaysFor(todo: TodoType, lead: LeadDays): number {
  const days =
    todo === TodoType.NEEDCARD
      ? lead.cardLeadDays
      : todo === TodoType.WHATSAPP
        ? lead.whatsappLeadDays
        : lead.presentLeadDays;
  return Math.max(0, days);
}

function taskText(
  todo: TodoType,
  fullName: string,
): { content: string; action: string } {
  switch (todo) {
    case TodoType.NEEDCARD:
      return {
        content: `✉️ Geburtstagskarte für ${fullName} schreiben`,
        action: 'Karte',
      };
    case TodoType.WHATSAPP:
      return {
        content: `💬 ${fullName} zum Geburtstag gratulieren`,
        action: 'WhatsApp',
      };
    default:
      return {
        content: `🎁 Geschenk für ${fullName} besorgen`,
        action: 'Geschenk',
      };
  }
}

export function planBirthdayTasks(
  birthdays: BirthdayLike[],
  lead: LeadDays,
  now: Date = new Date(),
  horizonDays: number = PLANNING_HORIZON_DAYS,
): PlannedTask[] {
  const today = startOfDay(now);
  const tasks: PlannedTask[] = [];

  for (const birthday of birthdays) {
    if (!birthday.dateOfBirth) continue;
    const parsed = parseBirthday(birthday.dateOfBirth);
    if (!parsed) continue;

    let next = birthdayInYear(today.getFullYear(), parsed.month, parsed.day);
    if (next < today) {
      next = birthdayInYear(today.getFullYear() + 1, parsed.month, parsed.day);
    }
    const daysUntil = Math.round((next.getTime() - today.getTime()) / DAY_MS);
    if (daysUntil > horizonDays) continue;

    // Mit Kalendertagen rechnen (robust gegen Sommerzeit-Umstellung).
    // Liegt die Fälligkeit schon in der Vergangenheit (z.B. frisch verbunden) -> heute
    const due = new Date(
      next.getFullYear(),
      next.getMonth(),
      next.getDate() - leadDaysFor(birthday.Todo, lead),
    );
    const dueDate = due < today ? today : due;

    const fullName = `${birthday.name} ${birthday.lastName}`.trim();
    const { content, action } = taskText(birthday.Todo, fullName);
    const age =
      parsed.birthYear !== null ? next.getFullYear() - parsed.birthYear : null;
    const description = [
      `${fullName} hat am ${pad(next.getDate())}.${pad(next.getMonth() + 1)}.${next.getFullYear()} Geburtstag` +
        (age !== null && age > 0 ? ` und wird ${age}.` : '.'),
      `Todo in Gifty McGiftface: ${action}`,
    ].join('\n');

    tasks.push({
      birthdayId: birthday.id,
      year: next.getFullYear(),
      content,
      description,
      dueDate: toIsoDate(dueDate),
    });
  }

  return tasks;
}
