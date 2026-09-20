import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BundleModule } from './bundle/bundle.module.js';
import { HealthModule } from './health/health.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        // request id + no PII beyond what's operationally necessary
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
        redact: ['req.headers.cookie', 'req.headers.authorization'],
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }], // per-IP default; login has its own tighter limit
    }),
    PrismaModule,
    AuthModule,
    BundleModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
