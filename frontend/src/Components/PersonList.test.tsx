import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonList from './PersonList';
import { birthdayApi } from '../APIService';
import type { Birthday } from '../entities/entities';

const people: Birthday[] = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  name: `Person${String(i + 1).padStart(2, '0')}`,
  lastName: 'Test',
  dateOfBirth: '--05-12',
  Todo: 'NEEDPRESENT',
}));

// jsdom kennt keinen IntersectionObserver: Callback manuell auslösen
let triggerIntersection: () => void = () => {};
class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    triggerIntersection = () =>
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  observe() {}
  disconnect() {}
}
// Für die ganze Datei aktiv lassen: nachlaufende Effects können ihn noch nach einem Test brauchen
vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

describe('PersonList', () => {
  beforeEach(() => {
    vi.spyOn(birthdayApi, 'getAllBirthdays').mockResolvedValue(people);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cards = () => screen.getAllByRole('heading', { level: 3 });

  it('zeigt Personen schrittweise beim Scrollen an', async () => {
    render(<PersonList />);
    expect(await screen.findByText('Alle Personen (60)')).toBeInTheDocument();
    expect(cards()).toHaveLength(24);

    act(() => triggerIntersection());
    expect(cards()).toHaveLength(48);

    act(() => triggerIntersection());
    expect(cards()).toHaveLength(60);
    expect(screen.getByText('Alle 60 Personen geladen')).toBeInTheDocument();
  });

  it('beginnt bei einer Suche wieder von vorne', async () => {
    const user = userEvent.setup();
    render(<PersonList />);
    await screen.findByText('Alle Personen (60)');
    act(() => triggerIntersection());
    expect(cards()).toHaveLength(48);

    await user.type(
      screen.getByPlaceholderText('Personen suchen...'),
      'Person0',
    );
    expect(screen.getByText('Alle Personen (9)')).toBeInTheDocument();
    expect(cards()).toHaveLength(9);
  });

  it('zeigt Datum ohne Jahr lesbar an', async () => {
    render(<PersonList />);
    await screen.findByText('Alle Personen (60)');
    expect(screen.getAllByText('12. Mai')).toHaveLength(24);
  });

  it('markiert geteilte Einträge und bietet dort kein Löschen an', async () => {
    vi.spyOn(birthdayApi, 'getAllBirthdays').mockResolvedValue([
      { ...people[0], name: 'Eigen' },
      {
        ...people[1],
        name: 'Geteilt',
        sharedBy: { name: 'Paula', lastName: 'Partner' },
      },
    ]);
    render(<PersonList />);
    await screen.findByText('Alle Personen (2)');

    expect(screen.getByText(/geteilt von Paula/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Bearbeiten' })).toHaveLength(
      2,
    );
    expect(
      screen.getByRole('button', { name: 'Eigen Test löschen' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Geteilt Test löschen' }),
    ).not.toBeInTheDocument();
  });
});
