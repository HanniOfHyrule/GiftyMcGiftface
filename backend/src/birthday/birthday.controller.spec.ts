import { Test, TestingModule } from '@nestjs/testing';
import { BirthdayController } from './birthday.controller';
import { BirthdayService } from './birthday.service';
import { Response } from 'express';
import {
  calendarDownloadsTotal,
  calendarFeedRequestsTotal,
  calendarUrlRegenerationsTotal,
} from '../metrics/metrics';
import { metricDelta } from '../metrics/testing';

describe('BirthdayController', () => {
  let controller: BirthdayController;

  let mockService: { findAll: jest.Mock };

  beforeEach(async () => {
    mockService = {
      findAll: jest
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Max', dateOfBirth: '2000-01-01' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BirthdayController],
      providers: [{ provide: BirthdayService, useValue: mockService }],
    }).compile();

    expect(mockService.findAll).not.toHaveBeenCalled();

    controller = module.get<BirthdayController>(BirthdayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll should return array of birthdays', async () => {
    const mockReq = { user: { sub: 1, email: 'test@example.com' } };
    const result = await controller.findAll(mockReq as any);
    expect(result).toEqual([{ id: 1, name: 'Max', dateOfBirth: '2000-01-01' }]);
    expect(mockService.findAll).toHaveBeenCalled();
  });
});

describe('BirthdayController calendar metrics', () => {
  const user = { sub: 1, email: 'test@example.com' };
  const token = 'a'.repeat(64);
  let service: {
    findAll: jest.Mock;
    findUserIdByCalendarToken: jest.Mock;
    regenerateCalendarToken: jest.Mock;
  };
  let controller: BirthdayController;
  const res = () =>
    ({ setHeader: jest.fn(), send: jest.fn() }) as unknown as Response;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findUserIdByCalendarToken: jest.fn().mockResolvedValue(1),
      regenerateCalendarToken: jest.fn().mockResolvedValue(token),
    };
    controller = new BirthdayController(service as never);
  });

  it('counts served public feed requests', async () => {
    const delta = await metricDelta(
      calendarFeedRequestsTotal,
      { result: 'served' },
      () => controller.getPublicICalFeed(`${token}.ics`, res()),
    );
    expect(delta).toBe(1);
  });

  it.each([
    ['a malformed token', 'nope.ics'],
    ['an unknown token', `${token}.ics`],
  ])('counts %s as not_found', async (_, file) => {
    service.findUserIdByCalendarToken.mockResolvedValue(null);
    const delta = await metricDelta(
      calendarFeedRequestsTotal,
      { result: 'not_found' },
      () => controller.getPublicICalFeed(file, res()).catch(() => undefined),
    );
    expect(delta).toBe(1);
  });

  it('counts downloads and URL regenerations', async () => {
    expect(
      await metricDelta(calendarDownloadsTotal, {}, () =>
        controller.getICalFeed(user, res()),
      ),
    ).toBe(1);
    expect(
      await metricDelta(calendarUrlRegenerationsTotal, {}, () =>
        controller.regenerateCalendarUrl(user),
      ),
    ).toBe(1);
  });
});
