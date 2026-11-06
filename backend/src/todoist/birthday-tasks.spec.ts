import { TodoType } from '../birthday/entities/birthday.entity';
import { BirthdayLike, planBirthdayTasks } from './birthday-tasks';

const lead = { presentLeadDays: 7, cardLeadDays: 5, whatsappLeadDays: 0 };

const birthday = (
  dateOfBirth: string | null,
  Todo: TodoType = TodoType.NEEDPRESENT,
  id = 1,
): BirthdayLike => ({
  id,
  name: 'Anna',
  lastName: 'Muster',
  dateOfBirth,
  Todo,
});

// Lokale Zeit, 10 Uhr
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10);

describe('planBirthdayTasks', () => {
  it('plant Geschenk 7 Tage, Karte 5 Tage und WhatsApp 0 Tage vorher', () => {
    const tasks = planBirthdayTasks(
      [
        birthday('1990-10-20', TodoType.NEEDPRESENT, 1),
        birthday('1990-10-20', TodoType.NEEDCARD, 2),
        birthday('1990-10-20', TodoType.WHATSAPP, 3),
      ],
      lead,
      on(2026, 10, 1),
    );
    expect(tasks.map((t) => t.dueDate)).toEqual([
      '2026-10-13',
      '2026-10-15',
      '2026-10-20',
    ]);
    expect(tasks[0].content).toBe('🎁 Geschenk für Anna Muster besorgen');
    expect(tasks[1].content).toBe(
      '✉️ Geburtstagskarte für Anna Muster schreiben',
    );
    expect(tasks[2].content).toBe('💬 Anna Muster zum Geburtstag gratulieren');
    expect(tasks[0].description).toContain(
      '20.10.2026 Geburtstag und wird 36.',
    );
    expect(tasks.every((t) => t.year === 2026)).toBe(true);
  });

  it('ignoriert Geburtstage außerhalb des Horizonts und ohne Datum', () => {
    const tasks = planBirthdayTasks(
      [birthday('1990-12-24'), birthday(null), birthday('kaputt')],
      lead,
      on(2026, 10, 1),
    );
    expect(tasks).toEqual([]);
  });

  it('setzt Fälligkeit auf heute, wenn der Vorlauf schon verstrichen ist', () => {
    const [task] = planBirthdayTasks(
      [birthday('1990-10-03')],
      lead,
      on(2026, 10, 1),
    );
    expect(task.dueDate).toBe('2026-10-01');
  });

  it('plant über den Jahreswechsel und nutzt das Jahr des Geburtstags', () => {
    const [task] = planBirthdayTasks(
      [birthday('--01-05')],
      lead,
      on(2026, 12, 20),
    );
    expect(task.year).toBe(2027);
    expect(task.dueDate).toBe('2026-12-29');
    expect(task.description).not.toContain('wird');
  });

  it('behandelt den 29. Februar in Nicht-Schaltjahren als 28. Februar', () => {
    const [task] = planBirthdayTasks(
      [birthday('2000-02-29', TodoType.WHATSAPP)],
      lead,
      on(2027, 2, 10),
    );
    expect(task.dueDate).toBe('2027-02-28');
  });

  it('bleibt bei der Sommerzeit-Umstellung auf dem richtigen Kalendertag', () => {
    // Umstellung Ende März liegt zwischen Fälligkeit und Geburtstag
    const [task] = planBirthdayTasks(
      [birthday('1990-04-02')],
      lead,
      on(2026, 3, 20),
    );
    expect(task.dueDate).toBe('2026-03-26');
  });

  it('plant einen Geburtstag heute noch ein', () => {
    const [task] = planBirthdayTasks(
      [birthday('1990-10-01', TodoType.WHATSAPP)],
      lead,
      on(2026, 10, 1),
    );
    expect(task.dueDate).toBe('2026-10-01');
  });
});
