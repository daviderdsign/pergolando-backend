import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaSessionStore } from './prisma-session-store.js';
import { SESSION_STORE } from './session-store.interface.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionAuthGuard,
    { provide: SESSION_STORE, useClass: PrismaSessionStore },
  ],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
