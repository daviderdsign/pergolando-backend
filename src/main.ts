import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api/v1');
  // Default Express JSON limit (100kb) is far too small for POST
  // catalog/perspective, which carries the site photo itself as base64
  // (pipeline step 3 — see PerspectiveService). A too-large body is
  // otherwise rejected by the body-parser middleware before it reaches any
  // NestJS request logging, so it silently surfaces as an unlabeled 500.
  app.useBodyParser('json', { limit: '15mb' });
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
await bootstrap();
