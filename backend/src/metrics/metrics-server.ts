import { createServer, Server } from 'http';
import { Logger } from '@nestjs/common';
import { register } from 'prom-client';

// Eigener, minimaler Server nur für /metrics auf METRICS_PORT (Standard 9100)
// statt einer Route in der Nest-App. Das ist Absicht: der nginx des Frontends
// leitet /api/* ungefiltert an den App-Port 3001 weiter, eine /metrics-Route
// dort wäre also öffentlich unter https://…/api/metrics erreichbar. Port 9100
// sollte nur intern für Prometheus erreichbar sein.
export function startMetricsServer(port: number): Server {
  const logger = new Logger('Metrics');
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    register
      .metrics()
      .then((body) => {
        res.writeHead(200, { 'Content-Type': register.contentType });
        res.end(body);
      })
      .catch((error: unknown) => {
        logger.error(`Metrics konnten nicht erzeugt werden: ${String(error)}`);
        res.writeHead(500).end();
      });
  });
  server.listen(port, () => {
    logger.log(`Metrics auf Port ${port} unter /metrics`);
  });
  return server;
}

export function metricsPort(): number {
  return Number(process.env.METRICS_PORT) || 9100;
}
