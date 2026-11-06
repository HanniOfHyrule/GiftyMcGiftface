import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, User, Calendar, Gift } from 'lucide-react';
import { Birthday } from '../entities/entities';
import { birthdayApi } from '../APIService';
import BirthdayDateInput from './BirthdayDateInput';

interface PersonFormProps {
  person?: Birthday | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const PersonAdd: React.FC<PersonFormProps> = ({
  person,
  isOpen,
  onClose,
  onSave,
}) => {
  // Wird bei jedem Öffnen neu gemountet (key in PersonList), daher reicht der Anfangszustand
  const [formData, setFormData] = useState({
    name: person?.name || '',
    lastName: person?.lastName || '',
    dateOfBirth: person?.dateOfBirth || '',
    Todo: (person?.Todo || 'NEEDPRESENT') as
      'WHATSAPP' | 'NEEDCARD' | 'NEEDPRESENT',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (person) {
        await birthdayApi.updateBirthday(person.id, formData);
      } else {
        await birthdayApi.createBirthday(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setError('Fehler beim Speichern. Bitte versuche es erneut.');
      console.error('Error saving person:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Esc schließt den Dialog; Seite im Hintergrund nicht scrollen lassen
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Per Portal direkt in <body> rendern: Eltern mit backdrop-filter würden
  // sonst den Bezugsrahmen für position: fixed verschieben.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90dvh] overflow-y-auto transform transition-all duration-300 scale-100"
        style={{
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          animation: 'modalSlideIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <User size={24} className="text-cyan-600" />
            {person ? 'Person bearbeiten' : 'Neue Person hinzufügen'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Vorname *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-cyan-500 focus:outline-none transition-colors duration-200"
              placeholder="Max"
            />
          </div>

          {/* Nachname */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nachname *
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-cyan-500 focus:outline-none transition-colors duration-200"
              placeholder="Mustermann"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-cyan-600" />
              Geburtsdatum
            </label>
            <BirthdayDateInput
              value={formData.dateOfBirth}
              onChange={(dateOfBirth) =>
                setFormData((prev) => ({ ...prev, dateOfBirth }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Gift size={16} className="text-cyan-600" />
              Aktion
            </label>
            <select
              name="Todo"
              value={formData.Todo}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:border-cyan-500 focus:outline-none transition-colors duration-200 bg-white"
            >
              <option value="NEEDPRESENT">🎁 Geschenk besorgen</option>
              <option value="NEEDCARD">💌 Karte besorgen</option>
              <option value="WHATSAPP">📱 WhatsApp senden</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-600 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 hover:shadow-lg hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save size={16} />
                  {person ? 'Aktualisieren' : 'Speichern'}
                </>
              )}
            </button>
          </div>
        </form>

        <style>{`
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>
      </div>
    </div>,
    document.body,
  );
};
