import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ListTodo,
  Link2,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import { TodoistLeadDays, TodoistStatus, todoistApi } from '../APIService';

type Notice = { type: 'success' | 'error'; text: string };

// Meldung nach der Rückkehr von Todoist (?todoist=connected|denied|error)
const noticeFromUrl = (): Notice | null => {
  const result = new URLSearchParams(window.location.search).get('todoist');
  if (result === 'connected') {
    return {
      type: 'success',
      text: 'Todoist ist verbunden. Aufgaben für die nächsten 30 Tage wurden angelegt.',
    };
  }
  if (result === 'denied') {
    return { type: 'error', text: 'Verbindung mit Todoist abgebrochen.' };
  }
  if (result === 'error') {
    return {
      type: 'error',
      text: 'Verbindung mit Todoist fehlgeschlagen. Bitte erneut versuchen.',
    };
  }
  return null;
};

const LEAD_FIELDS: { key: keyof TodoistLeadDays; label: string }[] = [
  { key: 'presentLeadDays', label: '🎁 Geschenk' },
  { key: 'cardLeadDays', label: '✉️ Karte' },
  { key: 'whatsappLeadDays', label: '💬 WhatsApp' },
];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const TodoistIntegration: React.FC = () => {
  const [status, setStatus] = useState<TodoistStatus | null>(null);
  const [leadDays, setLeadDays] = useState<TodoistLeadDays | null>(null);
  const [notice, setNotice] = useState<Notice | null>(noticeFromUrl);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const applyStatus = useCallback((next: TodoistStatus) => {
    setStatus(next);
    setLeadDays({
      presentLeadDays: next.presentLeadDays,
      cardLeadDays: next.cardLeadDays,
      whatsappLeadDays: next.whatsappLeadDays,
    });
  }, []);

  const loadStatus = useCallback(
    () =>
      todoistApi
        .getStatus()
        .then(applyStatus)
        .catch(() =>
          setNotice({
            type: 'error',
            text: 'Todoist-Status konnte nicht geladen werden.',
          }),
        ),
    [applyStatus],
  );

  useEffect(() => {
    loadStatus();
    // Parameter aus der URL entfernen, damit die Meldung beim Neuladen nicht erneut erscheint
    const url = new URL(window.location.href);
    if (url.searchParams.has('todoist')) {
      url.searchParams.delete('todoist');
      window.history.replaceState(null, '', url.toString());
    }
  }, [loadStatus]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = () =>
    run(async () => {
      window.location.href = await todoistApi.getAuthorizeUrl();
    });

  const handleSync = () =>
    run(async () => {
      const result = await todoistApi.sync();
      setNotice({
        type: 'success',
        text:
          result.created > 0
            ? `${result.created} neue Aufgabe(n) in Todoist angelegt.`
            : 'Alles aktuell, keine neuen Aufgaben nötig.',
      });
      await loadStatus();
    });

  const handleSaveSettings = () =>
    run(async () => {
      if (!leadDays) return;
      applyStatus(await todoistApi.updateSettings(leadDays));
      setNotice({ type: 'success', text: 'Einstellungen gespeichert.' });
    });

  const handleDisconnect = () =>
    run(async () => {
      await todoistApi.disconnect();
      setConfirmDisconnect(false);
      setNotice({ type: 'success', text: 'Todoist wurde getrennt.' });
      await loadStatus();
    });

  const settingsChanged =
    status !== null &&
    leadDays !== null &&
    LEAD_FIELDS.some(({ key }) => status[key] !== leadDays[key]);

  return (
    <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-8 mb-8">
      <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
        <ListTodo size={32} className="text-yellow-300" />
        Todoist
      </h2>
      <p className="text-white/90 mb-6">
        Legt täglich automatisch Aufgaben für Geburtstage in den nächsten 30
        Tagen im Todoist-Projekt „Gifty McGiftface“ an – passend zum Todo
        (Geschenk, Karte oder WhatsApp).
      </p>

      {notice && (
        <div
          className={`rounded-2xl px-4 py-3 mb-6 text-white border ${
            notice.type === 'success'
              ? 'bg-emerald-500/25 border-emerald-200/40'
              : 'bg-red-500/20 border-red-300/40'
          }`}
        >
          {notice.text}
        </div>
      )}

      {status === null ? (
        <p className="text-white/80">Lade Status...</p>
      ) : !status.configured ? (
        <div className="bg-yellow-400/20 border border-yellow-200/40 text-white rounded-2xl px-4 py-3 flex gap-3">
          <AlertTriangle
            size={20}
            className="text-yellow-300 shrink-0 mt-0.5"
          />
          <span>
            Die Todoist-Integration ist auf diesem Server noch nicht
            eingerichtet. Dafür müssen <code>TODOIST_CLIENT_ID</code> und{' '}
            <code>TODOIST_CLIENT_SECRET</code> gesetzt sein (siehe README).
          </span>
        </div>
      ) : !status.connected ? (
        <button
          onClick={handleConnect}
          disabled={busy}
          className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
        >
          <Link2 size={20} />
          Mit Todoist verbinden
        </button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6 text-white">
            <span className="flex items-center gap-2 bg-emerald-500/25 border border-emerald-200/40 rounded-xl px-3 py-1">
              <Check size={16} /> Verbunden
            </span>
            <span className="text-white/80 text-sm">
              {status.lastSyncAt
                ? `Letzte Synchronisation: ${formatDateTime(status.lastSyncAt)}`
                : 'Noch nicht synchronisiert'}
            </span>
          </div>

          {status.lastError && (
            <div className="bg-red-500/20 border border-red-300/40 text-white rounded-2xl px-4 py-3 mb-6 flex gap-3">
              <AlertTriangle
                size={20}
                className="text-red-200 shrink-0 mt-0.5"
              />
              <span>{status.lastError}</span>
            </div>
          )}

          <h3 className="text-white font-semibold mb-3">
            Fällig so viele Tage vor dem Geburtstag
          </h3>
          <div className="flex flex-wrap gap-4 mb-4">
            {LEAD_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex flex-col text-white/90 text-sm gap-1"
              >
                {label}
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={leadDays?.[key] ?? 0}
                  onChange={(e) =>
                    setLeadDays((prev) =>
                      prev
                        ? {
                            ...prev,
                            [key]: Math.min(
                              30,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          }
                        : prev,
                    )
                  }
                  className="w-24 bg-white/90 text-gray-800 rounded-xl px-3 py-2"
                />
              </label>
            ))}
          </div>
          <p className="text-white/70 text-sm mb-6">
            Änderungen gelten für neu angelegte Aufgaben.
          </p>

          <div className="flex flex-wrap gap-3 border-t border-white/20 pt-4">
            {settingsChanged && (
              <button
                onClick={handleSaveSettings}
                disabled={busy}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2 rounded-xl font-semibold shadow-lg disabled:opacity-50"
              >
                Einstellungen speichern
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={busy}
              className="bg-white/20 hover:bg-white/30 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
              Jetzt synchronisieren
            </button>
            {confirmDisconnect ? (
              <span className="flex flex-wrap items-center gap-2 text-white">
                Wirklich trennen? Bestehende Aufgaben bleiben in Todoist.
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl"
                >
                  Ja, trennen
                </button>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="bg-white/20 hover:bg-white/30 text-white font-semibold py-2 px-4 rounded-xl"
                >
                  Abbrechen
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDisconnect(true)}
                disabled={busy}
                className="text-white/80 hover:text-white px-3 py-2 flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Unlink size={16} />
                Trennen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TodoistIntegration;
