import { AddressInfo } from 'net';
import { Server } from 'http';
import * as request from 'supertest';
import { metricsPort, startMetricsServer } from './metrics-server';
import { signupsTotal } from './metrics';

describe('startMetricsServer', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = startMetricsServer(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('serves the registry in Prometheus text format on /metrics', async () => {
    signupsTotal.inc({ result: 'success' });
    const res = await request(url).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('gifty_signups_total{result="success"}');
    expect(res.text).toContain('gifty_process_cpu_seconds_total');
  });

  it('serves nothing else', async () => {
    expect((await request(url).get('/')).status).toBe(404);
    expect((await request(url).get('/health')).status).toBe(404);
    expect((await request(url).post('/metrics')).status).toBe(404);
  });
});

describe('metricsPort', () => {
  const original = process.env.METRICS_PORT;
  afterEach(() => {
    if (original === undefined) delete process.env.METRICS_PORT;
    else process.env.METRICS_PORT = original;
  });

  it('defaults to 9100', () => {
    delete process.env.METRICS_PORT;
    expect(metricsPort()).toBe(9100);
  });

  it('reads METRICS_PORT', () => {
    process.env.METRICS_PORT = '9200';
    expect(metricsPort()).toBe(9200);
  });
});
