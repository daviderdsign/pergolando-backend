import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { DomainException } from '../common/domain-exception.js';
import { SESSION_STORE, type SessionStore } from './session-store.interface.js';
import {
  ACCOUNT_LOCKOUT_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './auth.constants.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

export interface AuthenticatedSeller {
  id: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
  ) {}

  async register(dto: RegisterDto): Promise<AuthenticatedSeller> {
    const existing = await this.prisma.seller.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new DomainException(
        'EMAIL_ALREADY_REGISTERED',
        'Un venditore con questa email è già registrato.',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const seller = await this.prisma.seller.create({
      data: { email: dto.email, passwordHash },
    });
    return { id: seller.id, email: seller.email };
  }

  /** Returns a new session id; the controller is responsible for setting the cookie. */
  async login(
    dto: LoginDto,
  ): Promise<{ seller: AuthenticatedSeller; sessionId: string }> {
    const seller = await this.prisma.seller.findUnique({
      where: { email: dto.email },
    });
    if (!seller || seller.deletedAt) {
      throw new DomainException(
        'INVALID_CREDENTIALS',
        'Email o password non corretti.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (seller.lockedUntil && seller.lockedUntil.getTime() > Date.now()) {
      throw new DomainException(
        'ACCOUNT_LOCKED',
        'Troppi tentativi falliti. Riprova più tardi.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await argon2.verify(seller.passwordHash, dto.password);
    if (!valid) {
      await this.registerFailedAttempt(seller.id, seller.failedLoginAttempts);
      throw new DomainException(
        'INVALID_CREDENTIALS',
        'Email o password non corretti.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.seller.update({
      where: { id: seller.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    // Regenerated on every login, per the closed decision.
    const session = await this.sessions.create(seller.id);
    return {
      seller: { id: seller.id, email: seller.email },
      sessionId: session.id,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.delete(sessionId);
  }

  async validateSession(
    sessionId: string,
  ): Promise<AuthenticatedSeller | null> {
    const session = await this.sessions.find(sessionId);
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      await this.sessions.delete(sessionId);
      return null;
    }
    const seller = await this.prisma.seller.findUnique({
      where: { id: session.sellerId },
    });
    if (!seller || seller.deletedAt) return null;

    await this.sessions.touch(sessionId); // sliding expiry
    return { id: seller.id, email: seller.email };
  }

  private async registerFailedAttempt(
    sellerId: string,
    currentCount: number,
  ): Promise<void> {
    const attempts = currentCount + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + ACCOUNT_LOCKOUT_MS)
        : null;
    await this.prisma.seller.update({
      where: { id: sellerId },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
  }
}
