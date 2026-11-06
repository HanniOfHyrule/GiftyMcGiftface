import './load-env';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { httpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { metricsPort, startMetricsServer } from './metrics/metrics-server';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Vor allen Routen registrieren, damit jede Anfrage gezählt wird.
  app.use(httpMetricsMiddleware);

  // Hinter nginx (und ggf. weiteren Proxys) die echte Client-IP verwenden,
  // sonst teilen sich alle Nutzer ein Rate-Limit.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  // Im Docker-Setup läuft die API über den nginx-Proxy (gleiche Origin),
  // CORS ist nur für die lokale Entwicklung (Frontend :3000 -> Backend :3001) nötig.
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
  Logger.log(`Backend läuft auf Port ${port}`, 'Bootstrap');

  // Bewusst ein eigener Port, siehe metrics-server.ts
  startMetricsServer(metricsPort());
}
void bootstrap();
