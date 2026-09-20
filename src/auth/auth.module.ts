import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaSessionStore } from './prisma-session-store.js';
import { SESSION_STORE } from './session-store.interface.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { VerificationCodeService } from './verification-code.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionAuthGuard,
    VerificationCodeService,
    { provide: SESSION_STORE, useClass: PrismaSessionStore },
  ],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
