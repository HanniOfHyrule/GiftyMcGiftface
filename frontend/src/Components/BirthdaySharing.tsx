import React, { useCallback, useEffect, useState } from 'react';
import { Check, Send, Share2, X } from 'lucide-react';
import { sharingApi } from '../APIService';
import { Share, SharesOverview } from '../entities/entities';

type Notice = { type: 'success' | 'error'; text: string };

interface BirthdaySharingProps {
  /** Wird aufgerufen, wenn sich ändert, welche Geburtstage sichtbar sind */
  onChange?: () => void;
}

const fullName = (share: Share) =>
  `${share.user.name} ${share.user.lastName}`.trim();

const BirthdaySharing: React.FC<BirthdaySharingProps> = ({ onChange }) => {
  const [shares, setShares] = useState<SharesOverview | null>(null);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  // Freigabe, deren Beenden gerade bestätigt werden muss
  const [confirmEnd, setConfirmEnd] = useState<number | null>(null);

  const load = useCallback(
    () =>
      sharingApi
        .list()
        .then(setShares)
        .catch(() =>
          setNotice({
            type: 'error',
            text: 'Freigaben konnten nicht geladen werden.',
          }),
        ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const share = await sharingApi.invite(email.trim());
      setEmail('');
      setNotice({
        type: 'success',
        text: `Anfrage an ${fullName(share)} gesendet. Nach der Bestätigung sind deine Geburtstage dort sichtbar.`,
      });
      await load();
    });
  };

  const handleAccept = (share: Share) =>
    run(async () => {
      await sharingApi.accept(share.id);
      setNotice({
        type: 'success',
        text: `Die Geburtstage von ${fullName(share)} sind jetzt in deiner Liste.`,
      });
      await load();
      onChange?.();
    });

  const handleRemove = (share: Share, text: string) =>
    run(async () => {
      await sharingApi.remove(share.id);
      setConfirmEnd(null);
      setNotice({ type: 'success', text });
      await load();
      onChange?.();
    });

  const pendingIncoming =
    shares?.incoming.filter((s) => s.status === 'PENDING') ?? [];
  const acceptedIncoming =
    shares?.incoming.filter((s) => s.status === 'ACCEPTED') ?? [];

  const endButton = (share: Share, text: string) =>
    confirmEnd === share.id ? (
      <span className="flex flex-wrap items-center gap-2">
        Wirklich beenden?
        <button
          onClick={() => handleRemove(share, text)}
          disabled={busy}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-xl disabled:opacity-50"
        >
          Ja, beenden
        </button>
        <button
          onClick={() => setConfirmEnd(null)}
          className="bg-white/20 hover:bg-white/30 text-white font-semibold py-1 px-3 rounded-xl"
        >
          Abbrechen
        </button>
      </span>
    ) : (
      <button
        onClick={() => setConfirmEnd(share.id)}
        disabled={busy}
        className="text-white/80 hover:text-white px-3 py-1 text-sm disabled:opacity-50"
      >
        Beenden
      </button>
    );

  const row = (share: Share, actions: React.ReactNode, badge?: string) => (
    <li
      key={share.id}
      className="flex flex-wrap items-center justify-between gap-3 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white"
    >
      <span>
        <span className="font-semibold">{fullName(share)}</span>{' '}
        <span className="text-white/70 text-sm">{share.user.email}</span>
        {badge && (
          <span className="ml-3 text-xs bg-white/20 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2">{actions}</span>
    </li>
  );

  return (
    <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-8 mb-8">
      <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
        <Share2 size={32} className="text-yellow-300" />
        Geburtstage teilen
      </h2>
      <p className="text-white/90 mb-6">
        Teile alle deine Geburtstage mit einer anderen Person. Nach der
        Bestätigung erscheinen sie dort wie eigene Einträge – inklusive
        Kalender-Abo und Todoist – und können bearbeitet werden. Löschen kannst
        nur du.
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

      <form onSubmit={handleInvite} className="flex flex-wrap gap-3 mb-6">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail-Adresse"
          aria-label="E-Mail-Adresse der Person"
          className="flex-1 min-w-[16rem] bg-white/90 text-gray-800 rounded-xl px-4 py-2"
        />
        <button
          type="submit"
          disabled={busy || email.trim() === ''}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-2 shadow-lg disabled:opacity-50"
        >
          <Send size={16} />
          Teilen
        </button>
      </form>

      {shares === null ? (
        <p className="text-white/80">Lade Freigaben...</p>
      ) : (
        <div className="flex flex-col gap-6">
          {pendingIncoming.length > 0 && (
            <section>
              <h3 className="text-white font-semibold mb-3">
                Anfragen an dich
              </h3>
              <ul className="flex flex-col gap-2">
                {pendingIncoming.map((share) =>
                  row(
                    share,
                    <>
                      <button
                        onClick={() => handleAccept(share)}
                        disabled={busy}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1 px-3 rounded-xl flex items-center gap-1 disabled:opacity-50"
                      >
                        <Check size={16} />
                        Annehmen
                      </button>
                      <button
                        onClick={() =>
                          handleRemove(
                            share,
                            `Anfrage von ${fullName(share)} abgelehnt.`,
                          )
                        }
                        disabled={busy}
                        className="bg-white/20 hover:bg-white/30 text-white font-semibold py-1 px-3 rounded-xl flex items-center gap-1 disabled:opacity-50"
                      >
                        <X size={16} />
                        Ablehnen
                      </button>
                    </>,
                  ),
                )}
              </ul>
            </section>
          )}

          {acceptedIncoming.length > 0 && (
            <section>
              <h3 className="text-white font-semibold mb-3">Mit dir geteilt</h3>
              <ul className="flex flex-col gap-2">
                {acceptedIncoming.map((share) =>
                  row(
                    share,
                    endButton(
                      share,
                      `Die Geburtstage von ${fullName(share)} sind nicht mehr in deiner Liste.`,
                    ),
                  ),
                )}
              </ul>
            </section>
          )}

          {shares.outgoing.length > 0 && (
            <section>
              <h3 className="text-white font-semibold mb-3">Du teilst mit</h3>
              <ul className="flex flex-col gap-2">
                {shares.outgoing.map((share) =>
                  share.status === 'PENDING'
                    ? row(
                        share,
                        <button
                          onClick={() =>
                            handleRemove(
                              share,
                              `Anfrage an ${fullName(share)} zurückgezogen.`,
                            )
                          }
                          disabled={busy}
                          className="text-white/80 hover:text-white px-3 py-1 text-sm disabled:opacity-50"
                        >
                          Zurückziehen
                        </button>,
                        'Ausstehend',
                      )
                    : row(
                        share,
                        endButton(
                          share,
                          `Du teilst nicht mehr mit ${fullName(share)}.`,
                        ),
                        'Aktiv',
                      ),
                )}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default BirthdaySharing;
