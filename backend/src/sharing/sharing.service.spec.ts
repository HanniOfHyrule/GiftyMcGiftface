import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { SharingService } from './sharing.service';
import { BirthdayShare, ShareStatus } from './entities/birthday-share.entity';
import { User } from '../user/entities/user.entity';
import { birthdaySharesTotal } from '../metrics/metrics';
import { metricDelta } from '../metrics/testing';

const users: User[] = [
  new User({ id: 1, email: 'anna@example.com', name: 'Anna', lastName: 'A' }),
  new User({ id: 2, email: 'Ben@Example.com', name: 'Ben', lastName: 'B' }),
  new User({ id: 3, email: 'cleo@example.com', name: 'Cleo', lastName: 'C' }),
];

type Where = Partial<Record<keyof BirthdayShare, unknown>>;
type FindOpts = {
  where: Where;
  relations?: { owner?: boolean; recipient?: boolean };
};

// Minimaler In-Memory-Ersatz für das Freigabe-Repository
function fakeShares() {
  let rows: BirthdayShare[] = [];
  let nextId = 1;
  const matches = (row: BirthdayShare, where: Where) =>
    Object.entries(where).every(
      ([k, v]) => (row as unknown as Record<string, unknown>)[k] === v,
    );
  const withRelations = (row: BirthdayShare, opts: FindOpts) => ({
    ...row,
    owner: opts.relations?.owner
      ? users.find((u) => u.id === row.ownerId)!
      : undefined!,
    recipient: opts.relations?.recipient
      ? users.find((u) => u.id === row.recipientId)!
      : undefined!,
  });
  return {
    rows: () => rows,
    find: jest.fn((opts: FindOpts) =>
      Promise.resolve(
        rows
          .filter((r) => matches(r, opts.where))
          .map((r) => withRelations(r, opts)),
      ),
    ),
    findOne: jest.fn((opts: FindOpts) => {
      const row = rows.find((r) => matches(r, opts.where));
      return Promise.resolve(row ? withRelations(row, opts) : null);
    }),
    save: jest.fn((data: Partial<BirthdayShare>) => {
      const row = { ...data, id: nextId++, createdAt: new Date() };
      rows.push(row as BirthdayShare);
      return Promise.resolve(row);
    }),
    update: jest.fn((id: number, data: Partial<BirthdayShare>) => {
      rows = rows.map((r) => (r.id === id ? { ...r, ...data } : r));
      return Promise.resolve({ affected: 1 });
    }),
    delete: jest.fn(({ id }: { id: number }) => {
      rows = rows.filter((r) => r.id !== id);
      return Promise.resolve({ affected: 1 });
    }),
  };
}

// Wertet den Raw-Operator der E-Mail-Suche wie Postgres aus (LOWER = LOWER)
const fakeUsers = {
  findOne: jest.fn(({ where }: { where: { email: FindOperator<string> } }) => {
    const { email } = where.email.objectLiteralParameters as {
      email: string;
    };
    return Promise.resolve(
      users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null,
    );
  }),
};

describe('SharingService', () => {
  let shares: ReturnType<typeof fakeShares>;
  let service: SharingService;

  beforeEach(() => {
    shares = fakeShares();
    service = new SharingService(shares as never, fakeUsers as never);
  });

  describe('invite', () => {
    it('legt eine offene Anfrage an, unabhängig von Groß-/Kleinschreibung', async () => {
      const share = await service.invite(1, '  ben@example.COM ');

      expect(share).toMatchObject({
        status: ShareStatus.PENDING,
        user: { name: 'Ben', lastName: 'B', email: 'Ben@Example.com' },
      });
      expect(shares.rows()).toEqual([
        expect.objectContaining({
          ownerId: 1,
          recipientId: 2,
          status: ShareStatus.PENDING,
        }),
      ]);
    });

    it('vergleicht E-Mails in SQL ohne Groß-/Kleinschreibung', async () => {
      await service.invite(1, 'ben@example.com');
      const [[{ where }]] = fakeUsers.findOne.mock.calls;
      expect(where.email.getSql!('"email"')).toBe(
        'LOWER("email") = LOWER(:email)',
      );
    });

    it('lehnt unbekannte E-Mails ab', async () => {
      await expect(
        service.invite(1, 'niemand@example.com'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(shares.rows()).toHaveLength(0);
    });

    it('lehnt das Teilen mit sich selbst ab', async () => {
      await expect(
        service.invite(1, 'anna@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lehnt eine zweite Anfrage an denselben User ab', async () => {
      await service.invite(1, 'ben@example.com');
      await expect(service.invite(1, 'ben@example.com')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('erlaubt die Gegenrichtung als eigene Freigabe', async () => {
      await service.invite(1, 'ben@example.com');
      await expect(
        service.invite(2, 'anna@example.com'),
      ).resolves.toMatchObject({ user: { name: 'Anna' } });
      expect(shares.rows()).toHaveLength(2);
    });

    it('zählt gestellte Anfragen', async () => {
      expect(
        await metricDelta(birthdaySharesTotal, { action: 'requested' }, () =>
          service.invite(1, 'ben@example.com'),
        ),
      ).toBe(1);
    });
  });

  describe('accept', () => {
    it('bestätigt eine offene Anfrage durch den Empfänger', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      const delta = await metricDelta(
        birthdaySharesTotal,
        { action: 'accepted' },
        async () => {
          const share = await service.accept(2, id);
          expect(share).toMatchObject({
            status: ShareStatus.ACCEPTED,
            user: { name: 'Anna' },
          });
        },
      );
      expect(delta).toBe(1);
      expect(shares.rows()[0].status).toBe(ShareStatus.ACCEPTED);
      expect(shares.rows()[0].acceptedAt).toBeInstanceOf(Date);
    });

    it('lässt den Besitzer seine eigene Anfrage nicht bestätigen', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      await expect(service.accept(1, id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lässt Unbeteiligte nichts bestätigen', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      await expect(service.accept(3, id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('bestätigt eine Freigabe nicht zweimal', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      await service.accept(2, id);
      await expect(service.accept(2, id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    const removed = (action: string, fn: () => Promise<unknown>) =>
      metricDelta(birthdaySharesTotal, { action }, fn);

    it('Besitzer zieht zurück', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      expect(await removed('revoked', () => service.remove(1, id))).toBe(1);
      expect(shares.rows()).toHaveLength(0);
    });

    it('Empfänger lehnt eine offene Anfrage ab', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      expect(await removed('declined', () => service.remove(2, id))).toBe(1);
      expect(shares.rows()).toHaveLength(0);
    });

    it('Empfänger beendet eine bestätigte Freigabe', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      await service.accept(2, id);
      expect(await removed('left', () => service.remove(2, id))).toBe(1);
      expect(shares.rows()).toHaveLength(0);
    });

    it('Unbeteiligte können nichts entfernen', async () => {
      const { id } = await service.invite(1, 'ben@example.com');
      await expect(service.remove(3, id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(shares.rows()).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('liefert aus- und eingehende Freigaben mit der jeweiligen Gegenseite', async () => {
      await service.invite(1, 'ben@example.com');
      await service.invite(3, 'anna@example.com');

      const overview = await service.list(1);

      expect(overview.outgoing).toEqual([
        expect.objectContaining({
          user: { name: 'Ben', lastName: 'B', email: 'Ben@Example.com' },
        }),
      ]);
      expect(overview.incoming).toEqual([
        expect.objectContaining({
          user: { name: 'Cleo', lastName: 'C', email: 'cleo@example.com' },
        }),
      ]);
      expect(JSON.stringify(overview)).not.toContain('passwordHash');
    });
  });

  describe('ownerIdsVisibleTo', () => {
    it('enthält nur den User selbst und bestätigte Freigaben', async () => {
      const fromAnna = await service.invite(1, 'ben@example.com');
      await service.invite(3, 'ben@example.com');
      await service.accept(2, fromAnna.id);

      expect(await service.ownerIdsVisibleTo(2)).toEqual([2, 1]);
      expect(await service.ownerIdsVisibleTo(1)).toEqual([1]);
    });
  });
});
