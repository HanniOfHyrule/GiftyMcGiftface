import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  BirthdayParts,
  MONTHS,
  daysInMonth,
  formatBirthdayLabel,
  formatBirthdayValue,
  parseBirthday,
  upcomingAge,
} from '../utils/birthday';

interface BirthdayDateInputProps {
  /** YYYY-MM-DD, --MM-DD oder leer */
  value: string;
  onChange: (value: string) => void;
}

const fieldClass =
  'w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-base bg-white focus:border-cyan-500 focus:outline-none transition-colors duration-200';

const currentYear = new Date().getFullYear();

/**
 * Geburtstagseingabe mit Tag, Monat und optionalem Jahr.
 * Ohne Jahr wird der Geburtstag als --MM-DD gespeichert.
 */
const BirthdayDateInput: React.FC<BirthdayDateInputProps> = ({
  value,
  onChange,
}) => {
  const [parts, setParts] = useState<BirthdayParts>(() => parseBirthday(value));
  // Jahr als Text, damit Zwischenstände wie "19" beim Tippen möglich sind
  const [yearText, setYearText] = useState(() =>
    parts.year ? String(parts.year) : '',
  );

  const update = (next: BirthdayParts) => {
    // Tag kürzen, wenn er im gewählten Monat nicht existiert (z.B. 31. April)
    const maxDay = daysInMonth(next.month, next.year);
    const day = next.day && next.day > maxDay ? maxDay : next.day;
    const normalized = { ...next, day };
    setParts(normalized);
    onChange(formatBirthdayValue(normalized));
  };

  const handleYear = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setYearText(digits);
    const year = Number(digits);
    const valid = digits.length === 4 && year >= 1900 && year <= currentYear;
    update({ ...parts, year: valid ? year : null });
  };

  const clear = () => {
    setYearText('');
    update({ day: null, month: null, year: null });
  };

  const yearInvalid =
    yearText.length > 0 && !(yearText.length === 4 && parts.year !== null);
  const age = upcomingAge(parts);
  const complete = parts.day !== null && parts.month !== null;

  return (
    <div>
      <div className="grid grid-cols-[5rem_1fr_6.5rem] gap-2">
        <select
          aria-label="Tag"
          value={parts.day ?? ''}
          onChange={(e) =>
            update({
              ...parts,
              day: e.target.value ? Number(e.target.value) : null,
            })
          }
          className={fieldClass}
        >
          <option value="">Tag</option>
          {Array.from(
            { length: daysInMonth(parts.month, parts.year) },
            (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}.
              </option>
            ),
          )}
        </select>

        <select
          aria-label="Monat"
          value={parts.month ?? ''}
          onChange={(e) =>
            update({
              ...parts,
              month: e.target.value ? Number(e.target.value) : null,
            })
          }
          className={fieldClass}
        >
          <option value="">Monat</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>

        <input
          aria-label="Jahr (optional)"
          inputMode="numeric"
          placeholder="Jahr"
          value={yearText}
          onChange={(e) => handleYear(e.target.value)}
          className={`${fieldClass} ${yearInvalid ? 'border-red-300 focus:border-red-400' : ''}`}
        />
      </div>

      <div className="flex items-center justify-between mt-2 min-h-6 text-sm">
        <span className={yearInvalid ? 'text-red-600' : 'text-gray-500'}>
          {yearInvalid
            ? `Jahr zwischen 1900 und ${currentYear} eingeben – oder leer lassen`
            : complete
              ? `🎂 ${formatBirthdayLabel(formatBirthdayValue(parts))}${
                  age !== null ? ` · wird ${age}` : ' · Jahr unbekannt'
                }`
              : 'Jahr ist optional'}
        </span>
        {(complete || yearText) && (
          <button
            type="button"
            onClick={clear}
            className="text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X size={14} />
            Leeren
          </button>
        )}
      </div>
    </div>
  );
};

export default BirthdayDateInput;
