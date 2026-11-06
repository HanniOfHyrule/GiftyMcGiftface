import * as express from 'express';
import * as request from 'supertest';
import {
  httpMetricsMiddleware,
  httpRequestDuration,
  httpRequestsTotal,
} from './http-metrics.middleware';
import { metricDelta } from './testing';

describe('httpMetricsMiddleware', () => {
  const app = express();
  app.use(httpMetricsMiddleware);
  const router = express.Router();
  router.get('/:id', (req, res) => {
    res.status(req.params.id === 'missing' ? 404 : 200).send('ok');
  });
  app.use('/birthdays', router);

  it('labels by route pattern, not by the concrete path', async () => {
    const delta = await metricDelta(
      httpRequestsTotal,
      { method: 'GET', route: '/birthdays/:id', status: '200' },
      async () => {
        await request(app).get('/birthdays/1');
        await request(app).get('/birthdays/2');
      },
    );
    expect(delta).toBe(2);
    const { values } = await httpRequestsTotal.get();
    expect(values.some((v) => v.labels.route === '/birthdays/1')).toBe(false);
  });

  it('records the status code the handler sent', async () => {
    const delta = await metricDelta(
      httpRequestsTotal,
      { method: 'GET', route: '/birthdays/:id', status: '404' },
      () => request(app).get('/birthdays/missing'),
    );
    expect(delta).toBe(1);
  });

  it('groups requests that match no route under "unmatched"', async () => {
    const delta = await metricDelta(
      httpRequestsTotal,
      { method: 'GET', route: 'unmatched', status: '404' },
      async () => {
        await request(app).get('/wp-login.php');
        await request(app).get('/.env');
      },
    );
    expect(delta).toBe(2);
  });

  it('observes the request duration', async () => {
    await request(app).get('/birthdays/1');
    const { values } = await httpRequestDuration.get();
    const count = values.find(
      (v) =>
        v.metricName === 'gifty_http_request_duration_seconds_count' &&
        v.labels.route === '/birthdays/:id',
    );
    expect(count?.value).toBeGreaterThan(0);
  });
});
