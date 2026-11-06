import { NextFunction, Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';

// Gelabelt nach dem Routen-*Muster* ("/birthdays/:id"), nicht nach dem echten
// Pfad – sonst bekäme jede ID und jeder Kalender-Token eine eigene Zeitreihe.
// Das Muster kennt Express erst nach dem Routing, deshalb wird es erst beim
// "finish" der Antwort gelesen.
export const httpRequestsTotal = new Counter({
  name: 'gifty_http_requests_total',
  help: 'Total number of HTTP requests, by method, route and status code.',
  labelNames: ['method', 'route', 'status'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'gifty_http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by method and route.',
  labelNames: ['method', 'route'] as const,
});

function routePattern(req: Request): string {
  const route = req.route as { path?: unknown } | undefined;
  // Keine Route getroffen (404) – alle unter einem Label sammeln statt eines
  // pro Pfad, den ein Scanner ausprobiert. Nest registriert nur String-Pfade.
  if (typeof route?.path !== 'string') return 'unmatched';
  return `${req.baseUrl}${route.path}`;
}

export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const route = routePattern(req);
    const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status: String(res.statusCode),
    });
    httpRequestDuration.observe({ method: req.method, route }, seconds);
  });
  next();
}
