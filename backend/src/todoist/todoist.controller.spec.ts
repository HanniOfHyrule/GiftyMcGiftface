// @nestjs/schedule wird als ES-Modul ausgeliefert, das Jest (CommonJS) nicht laden kann
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));
import { Response } from 'express';
import { TodoistController } from './todoist.controller';
import { TodoistService } from './todoist.service';
import { todoistConnectionsTotal } from '../metrics/metrics';
import { metricDelta } from '../metrics/testing';

describe('TodoistController callback', () => {
  let handleCallback: jest.Mock;
  let controller: TodoistController;
  let res: { redirect: jest.Mock };

  beforeEach(() => {
    handleCallback = jest.fn().mockResolvedValue(42);
    controller = new TodoistController({
      appUrl: () => 'https://gifty.example.com',
      handleCallback,
    } as unknown as TodoistService);
    res = { redirect: jest.fn() };
  });

  const callback = (code?: string, state?: string, error?: string) =>
    controller.callback(code, state, error, res as unknown as Response);

  it('counts a successful connection', async () => {
    const delta = await metricDelta(
      todoistConnectionsTotal,
      { result: 'connected' },
      () => callback('code', 'state'),
    );
    expect(delta).toBe(1);
    expect(res.redirect).toHaveBeenCalledWith(
      'https://gifty.example.com/dashboard?todoist=connected',
    );
  });

  it('counts a denied authorization', async () => {
    const delta = await metricDelta(
      todoistConnectionsTotal,
      { result: 'denied' },
      () => callback(undefined, undefined, 'access_denied'),
    );
    expect(delta).toBe(1);
    expect(res.redirect).toHaveBeenCalledWith(
      'https://gifty.example.com/dashboard?todoist=denied',
    );
  });

  it('counts a callback without code as error', async () => {
    const delta = await metricDelta(
      todoistConnectionsTotal,
      { result: 'error' },
      () => callback(undefined, 'state'),
    );
    expect(delta).toBe(1);
  });

  it('counts a failing token exchange as error', async () => {
    handleCallback.mockRejectedValue(new Error('nope'));
    const delta = await metricDelta(
      todoistConnectionsTotal,
      { result: 'error' },
      () => callback('code', 'state'),
    );
    expect(delta).toBe(1);
  });
});
