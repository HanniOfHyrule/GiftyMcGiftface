import React, { useState, useEffect } from 'react';
import {
  CalendarPlus,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { calendarApi } from '../APIService';

const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(
  window.location.hostname,
);

const CalendarSubscription: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const loadUrl = () =>
    calendarApi
      .getSubscriptionUrl()
      .then(setUrl)
      .catch((err) => {
        console.error('Error loading calendar URL:', err);
        setError('Kalender-Link konnte nicht geladen werden.');
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    loadUrl();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback für Browser ohne Clipboard-API (z.B. http ohne localhost)
      const input = document.getElementById(
        'calendar-url',
      ) as HTMLInputElement | null;
      input?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      setUrl(await calendarApi.regenerateSubscriptionUrl());
      setConfirmRegenerate(false);
    } catch (err) {
      console.error('Error regenerating calendar URL:', err);
      setError('Neuer Kalender-Link konnte nicht erzeugt werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-8 mb-8">
      <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
        <CalendarPlus size={32} className="text-yellow-300" />
        Kalender Link
      </h2>
      <p className="text-white/90 mb-6">
        Abonniere deine Geburtstage in deinem Kalender. Neue und geänderte
        Einträge werden automatisch übernommen.
      </p>

      {error && (
        <div className="bg-red-500/20 border border-red-300/40 text-white rounded-2xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          id="calendar-url"
          type="text"
          readOnly
          value={loading ? 'Lade Link...' : url}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 basis-64 bg-white/90 text-gray-800 rounded-2xl px-4 py-3 font-mono text-sm"
        />
        <button
          onClick={handleCopy}
          disabled={loading || !url}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
          {copied ? 'Kopiert!' : 'Link kopieren'}
        </button>
      </div>

      {isLocalHost && (
        <div className="bg-yellow-400/20 border border-yellow-200/40 text-white rounded-2xl px-4 py-3 mb-6 flex gap-3">
          <AlertTriangle
            size={20}
            className="text-yellow-300 shrink-0 mt-0.5"
          />
          <span>
            Die App läuft auf <strong>localhost</strong>. Proton ruft den Link
            von seinen eigenen Servern ab und kann ihn so nicht erreichen. Die
            App muss öffentlich per HTTPS erreichbar sein (z.B. über eine Domain
            oder einen Tunnel).
          </span>
        </div>
      )}

      <ol className="list-decimal list-inside text-white/90 space-y-1 mb-6">
        <li>Link oben kopieren.</li>
        <li>
          Proton Calendar öffnen (calendar.proton.me) und in der Seitenleiste
          bei „Andere Kalender“ auf <strong>+</strong> klicken.
        </li>
        <li>
          <strong>„Kalender über URL hinzufügen“</strong> wählen, Link einfügen
          und speichern.
        </li>
      </ol>

      <div className="border-t border-white/20 pt-4">
        {confirmRegenerate ? (
          <div className="flex flex-wrap items-center gap-3 text-white">
            <span>
              Der alte Link funktioniert danach nicht mehr. Fortfahren?
            </span>
            <button
              onClick={handleRegenerate}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl transition"
            >
              Ja, neuen Link erzeugen
            </button>
            <button
              onClick={() => setConfirmRegenerate(false)}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-xl transition"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRegenerate(true)}
            disabled={loading}
            className="text-white/80 hover:text-white flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Neuen Link erzeugen (falls der alte weitergegeben wurde)
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarSubscription;
