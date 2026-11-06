import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BirthdaySharing from './BirthdaySharing';
import { ApiError, sharingApi } from '../APIService';
import type { Share, SharesOverview } from '../entities/entities';

const share = (
  id: number,
  status: Share['status'],
  name: string,
  email: string,
): Share => ({
  id,
  status,
  createdAt: '2026-10-01T10:00:00.000Z',
  user: { name, lastName: 'Test', email },
});

const overview: SharesOverview = {
  outgoing: [
    share(1, 'PENDING', 'Ben', 'ben@example.com'),
    share(2, 'ACCEPTED', 'Cleo', 'cleo@example.com'),
  ],
  incoming: [
    share(3, 'PENDING', 'Dora', 'dora@example.com'),
    share(4, 'ACCEPTED', 'Emil', 'emil@example.com'),
  ],
};

describe('BirthdaySharing', () => {
  beforeEach(() => {
    vi.spyOn(sharingApi, 'list').mockResolvedValue(overview);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt Anfragen, eingehende und ausgehende Freigaben getrennt an', async () => {
    render(<BirthdaySharing />);

    expect(await screen.findByText('Anfragen an dich')).toBeInTheDocument();
    expect(screen.getByText('Mit dir geteilt')).toBeInTheDocument();
    expect(screen.getByText('Du teilst mit')).toBeInTheDocument();
    expect(screen.getByText('Ausstehend')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('sendet eine Anfrage an die eingegebene E-Mail', async () => {
    const user = userEvent.setup();
    const invite = vi
      .spyOn(sharingApi, 'invite')
      .mockResolvedValue(share(5, 'PENDING', 'Finn', 'finn@example.com'));
    render(<BirthdaySharing />);
    await screen.findByText('Du teilst mit');

    await user.type(
      screen.getByLabelText('E-Mail-Adresse der Person'),
      'finn@example.com',
    );
    await user.click(screen.getByRole('button', { name: /Teilen/ }));

    expect(invite).toHaveBeenCalledWith('finn@example.com');
    expect(
      await screen.findByText(/Anfrage an Finn Test gesendet/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-Mail-Adresse der Person')).toHaveValue('');
  });

  it('zeigt Fehler vom Server an', async () => {
    const user = userEvent.setup();
    vi.spyOn(sharingApi, 'invite').mockRejectedValue(
      new ApiError('Kein Nutzer mit dieser E-Mail gefunden', 404),
    );
    render(<BirthdaySharing />);
    await screen.findByText('Du teilst mit');

    await user.type(
      screen.getByLabelText('E-Mail-Adresse der Person'),
      'niemand@example.com',
    );
    await user.click(screen.getByRole('button', { name: /Teilen/ }));

    expect(
      await screen.findByText('Kein Nutzer mit dieser E-Mail gefunden'),
    ).toBeInTheDocument();
  });

  it('nimmt eine Anfrage an und meldet die Änderung', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const accept = vi
      .spyOn(sharingApi, 'accept')
      .mockResolvedValue({ ...overview.incoming[0], status: 'ACCEPTED' });
    render(<BirthdaySharing onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: /Annehmen/ }));

    expect(accept).toHaveBeenCalledWith(3);
    expect(onChange).toHaveBeenCalled();
    expect(
      await screen.findByText(/Geburtstage von Dora Test sind jetzt/),
    ).toBeInTheDocument();
  });

  it('lehnt eine Anfrage ohne Rückfrage ab', async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(sharingApi, 'remove').mockResolvedValue();
    render(<BirthdaySharing />);

    await user.click(await screen.findByRole('button', { name: /Ablehnen/ }));

    expect(remove).toHaveBeenCalledWith(3);
  });

  it('zieht eine ausstehende Anfrage zurück', async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(sharingApi, 'remove').mockResolvedValue();
    render(<BirthdaySharing />);

    await user.click(
      await screen.findByRole('button', { name: 'Zurückziehen' }),
    );

    expect(remove).toHaveBeenCalledWith(1);
  });

  it('beendet eine aktive Freigabe erst nach Bestätigung', async () => {
    const user = userEvent.setup();
    const remove = vi.spyOn(sharingApi, 'remove').mockResolvedValue();
    render(<BirthdaySharing />);

    const [endIncoming] = await screen.findAllByRole('button', {
      name: 'Beenden',
    });
    await user.click(endIncoming);
    expect(remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ja, beenden' }));
    expect(remove).toHaveBeenCalledWith(4);
  });
});
