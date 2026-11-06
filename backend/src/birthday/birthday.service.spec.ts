import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { In } from 'typeorm';
import { BirthdayService } from './birthday.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Birthday, TodoType } from './entities/birthday.entity';
import { User } from '../user/entities/user.entity';
import {
  birthdaysCreatedTotal,
  birthdaysDeletedTotal,
  birthdaysUpdatedTotal,
} from '../metrics/metrics';
import { metricDelta } from '../metrics/testing';
import { SharingService } from '../sharing/sharing.service';

// User 1 sieht seine eigenen Geburtstage und die von User 2 (geteilt)
const sharingWithOwner2 = () =>
  ({
    ownerIdsVisibleTo: jest.fn().mockResolvedValue([1, 2]),
  }) as unknown as SharingService;
const sharingNone = () =>
  ({
    ownerIdsVisibleTo: jest.fn((userId: number) => Promise.resolve([userId])),
  }) as unknown as SharingService;

describe('BirthdayService', () => {
  let service: BirthdayService;
  let repo: { find: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdayService,
        { provide: getRepositoryToken(Birthday), useValue: repo },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: SharingService, useValue: sharingNone() },
      ],
    }).compile();

    service = module.get<BirthdayService>(BirthdayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll should return mapped birthdays', async () => {
    repo.find.mockResolvedValue([
      { id: 1, name: 'Anna', lastName: 'Muster', dateOfBirth: '2000-01-01' },
    ]);
    const result = await service.findAll(1);
    expect(result[0]).toBeInstanceOf(Birthday);
    expect(result[0].name).toBe('Anna');
    expect(repo.find).toHaveBeenCalled();
  });

  it('findDuplicates should return duplicate groups', async () => {
    // Mock findAll to return duplicates
    jest.spyOn(service, 'findAll').mockResolvedValue([
      new Birthday({
        name: 'Anna',
        lastName: 'Muster',
        dateOfBirth: '2000-01-01',
      }),
      new Birthday({
        name: 'Anna',
        lastName: 'Muster',
        dateOfBirth: '2001-01-01',
      }),
      new Birthday({
        name: 'Ben',
        lastName: 'Test',
        dateOfBirth: '2002-02-02',
      }),
    ]);
    const result = await service.findDuplicates(1);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Anna');
    expect(result[0].entries.length).toBe(2);
  });
});

describe('BirthdayService metrics', () => {
  const birthday = {
    id: 7,
    name: 'Anna',
    lastName: 'Muster',
    dateOfBirth: '2000-01-01',
    Todo: TodoType.NEEDPRESENT,
  };
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    manager: { getRepository: () => { findOneBy: jest.Mock } };
  };
  let service: BirthdayService;

  beforeEach(() => {
    repo = {
      create: jest.fn((data: object) => data),
      save: jest.fn((data: object) => Promise.resolve({ ...data, id: 7 })),
      findOne: jest.fn().mockResolvedValue(birthday),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        getRepository: () => ({
          findOneBy: jest.fn().mockResolvedValue({ id: 1 }),
        }),
      },
    };
    service = new BirthdayService(repo as never, {} as never, sharingNone());
  });

  it('counts created birthdays', async () => {
    const delta = await metricDelta(birthdaysCreatedTotal, {}, () =>
      service.create(birthday, 1),
    );
    expect(delta).toBe(1);
  });

  it('counts updates only when the birthday exists', async () => {
    expect(
      await metricDelta(birthdaysUpdatedTotal, {}, () =>
        service.update(7, { name: 'Anne' }, 1),
      ),
    ).toBe(1);
    repo.findOne.mockResolvedValue(null);
    expect(
      await metricDelta(birthdaysUpdatedTotal, {}, () =>
        service.update(8, { name: 'Anne' }, 1),
      ),
    ).toBe(0);
  });

  it('counts deletions only when a row was deleted', async () => {
    expect(
      await metricDelta(birthdaysDeletedTotal, {}, () => service.remove(7, 1)),
    ).toBe(1);
    repo.delete.mockResolvedValue({ affected: 0 });
    expect(
      await metricDelta(birthdaysDeletedTotal, {}, () => service.remove(8, 1)),
    ).toBe(0);
  });
});

describe('BirthdayService sharing', () => {
  const own = {
    id: 1,
    name: 'Anna',
    lastName: 'Eigen',
    dateOfBirth: '2000-01-01',
    Todo: TodoType.NEEDPRESENT,
    user: { id: 1, name: 'Ich', lastName: 'Selbst', passwordHash: 'secret' },
  };
  const shared = {
    id: 2,
    name: 'Ben',
    lastName: 'Geteilt',
    dateOfBirth: '1990-05-05',
    Todo: TodoType.WHATSAPP,
    user: { id: 2, name: 'Paula', lastName: 'Partner', passwordHash: 'x' },
  };
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    exists: jest.Mock;
    count: jest.Mock;
  };
  let service: BirthdayService;

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([own, shared]),
      findOne: jest.fn().mockResolvedValue(shared),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      exists: jest.fn().mockResolvedValue(true),
      count: jest.fn().mockResolvedValue(2),
    };
    service = new BirthdayService(
      repo as never,
      {} as never,
      sharingWithOwner2(),
    );
  });

  it('findAll lädt eigene und geteilte Geburtstage und markiert geteilte', async () => {
    const result = await service.findAll(1);

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { id: In([1, 2]) } } }),
    );
    expect(result.map((b) => b.sharedBy)).toEqual([
      null,
      { name: 'Paula', lastName: 'Partner' },
    ]);
  });

  it('findAll gibt keine Daten des Besitzers außer dem Namen heraus', async () => {
    const [, sharedResult] = await service.findAll(1);
    const json = JSON.stringify(sharedResult);
    expect(json).not.toContain('passwordHash');
    expect(sharedResult.user).toBeUndefined();
  });

  it('update erlaubt das Bearbeiten geteilter Einträge', async () => {
    const result = await service.update(2, { name: 'Benjamin' }, 1);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 2, user: { id: In([1, 2]) } },
    });
    expect(repo.update).toHaveBeenCalledWith({ id: 2 }, { name: 'Benjamin' });
    expect(result).not.toBeNull();
  });

  it('update liefert null für fremde, nicht geteilte Einträge', async () => {
    repo.findOne.mockResolvedValue(null);
    expect(await service.update(99, { name: 'X' }, 1)).toBeNull();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('remove verbietet dem Empfänger das Löschen geteilter Einträge', async () => {
    await expect(service.remove(2, 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.delete).toHaveBeenCalledWith({ id: 2, user: { id: 1 } });
    expect(repo.exists).toHaveBeenCalledWith({
      where: { id: 2, user: { id: In([2]) } },
    });
  });

  it('remove meldet unbekannte Einträge weiterhin als nicht gefunden', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(service.remove(99, 1)).resolves.toEqual({
      deleted: false,
      message: 'Birthday not found',
    });
  });

  it('getStatistics zählt geteilte Geburtstage mit', async () => {
    const stats = await service.getStatistics(1);
    expect(repo.count).toHaveBeenCalledWith({
      where: { user: { id: In([1, 2]) } },
    });
    expect(stats.total).toBe(2);
  });
});
