import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonAdd } from './PersonAdd';

describe('PersonAdd', () => {
  it('rendert den Dialog direkt in <body>, nicht im Eltern-Element', () => {
    const { container } = render(
      <div style={{ backdropFilter: 'blur(4px)' }}>
        <PersonAdd isOpen onClose={vi.fn()} onSave={vi.fn()} />
      </div>,
    );
    const dialog = screen.getByRole('dialog');
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
  });

  it('schließt mit Escape und sperrt das Scrollen im Hintergrund', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(
      <PersonAdd isOpen onClose={onClose} onSave={vi.fn()} />,
    );
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('füllt beim Bearbeiten Datum ohne Jahr korrekt vor', () => {
    render(
      <PersonAdd
        isOpen
        person={{
          id: 1,
          name: 'Ben',
          lastName: 'Beispiel',
          dateOfBirth: '--11-15',
          Todo: 'WHATSAPP',
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Tag')).toHaveValue('15');
    expect(screen.getByLabelText('Monat')).toHaveValue('11');
    expect(screen.getByLabelText('Jahr (optional)')).toHaveValue('');
  });
});
