import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BirthdayDateInput from './BirthdayDateInput';
import {
  daysInMonth,
  formatBirthdayLabel,
  parseBirthday,
} from '../utils/birthday';

describe('birthday utils', () => {
  it('liest Daten mit und ohne Jahr', () => {
    expect(parseBirthday('1990-05-12')).toEqual({
      year: 1990,
      month: 5,
      day: 12,
    });
    expect(parseBirthday('--11-15')).toEqual({
      year: null,
      month: 11,
      day: 15,
    });
    expect(parseBirthday('')).toEqual({ year: null, month: null, day: null });
  });

  it('formatiert lesbar', () => {
    expect(formatBirthdayLabel('1990-05-12')).toBe('12. Mai 1990');
    expect(formatBirthdayLabel('--11-15')).toBe('15. November');
    expect(formatBirthdayLabel(null)).toBe('Kein Datum');
  });

  it('erlaubt den 29. Februar nur ohne Jahr oder im Schaltjahr', () => {
    expect(daysInMonth(2, null)).toBe(29);
    expect(daysInMonth(2, 2000)).toBe(29);
    expect(daysInMonth(2, 1990)).toBe(28);
  });
});

describe('BirthdayDateInput', () => {
  it('liefert --MM-DD ohne Jahr und YYYY-MM-DD mit Jahr', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BirthdayDateInput value="" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Tag'), '5');
    await user.selectOptions(screen.getByLabelText('Monat'), '11');
    expect(onChange).toHaveBeenLastCalledWith('--11-05');
    expect(
      screen.getByText(/5\. November · Jahr unbekannt/),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Jahr (optional)'), '1990');
    expect(onChange).toHaveBeenLastCalledWith('1990-11-05');
  });

  it('kürzt den Tag, wenn der Monat weniger Tage hat', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BirthdayDateInput value="1990-01-31" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Monat'), '4');
    expect(onChange).toHaveBeenLastCalledWith('1990-04-30');
  });

  it('zeigt einen Hinweis bei ungültigem Jahr und speichert ohne Jahr', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BirthdayDateInput value="--03-10" onChange={onChange} />);

    await user.type(screen.getByLabelText('Jahr (optional)'), '3000');
    expect(screen.getByText(/Jahr zwischen 1900/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith('--03-10');
  });
});
