import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { DomainException } from '../common/domain-exception.js';
import { MailService } from '../mail/mail.service.js';
import { SESSION_STORE, type SessionStore } from './session-store.interface.js';
import { VerificationCodeService } from './verification-code.service.js';
import {
  ACCOUNT_LOCKOUT_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './auth.constants.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { VerifyEmailDto } from './dto/verify-email.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';

export interface AuthenticatedSeller {
  id: string;
  email: string;
}

/** Toggled off in dev/test when SMTP isn't set up; defaults on otherwise. */
function emailVerificationEnabled(): boolean {
  return process.env.EMAIL_VERIFICATION_ENABLED !== 'false';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    private readonly mail: MailService,
    private readonly verificationCodes: VerificationCodeService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ seller: AuthenticatedSeller; verificationRequired: boolean }> {
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
    const verificationRequired = emailVerificationEnabled();
    const seller = await this.prisma.seller.create({
      data: {
        email: dto.email,
        passwordHash,
        emailVerifiedAt: verificationRequired ? null : new Date(),
      },
    });

    if (verificationRequired) {
      const code = await this.verificationCodes.issue(
        seller.id,
        'EMAIL_VERIFICATION',
      );
      await this.mail.sendVerificationCode(seller.email, code);
    }

    return {
      seller: { id: seller.id, email: seller.email },
      verificationRequired,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const seller = await this.findActiveSellerOrThrowGenericCodeError(
      dto.email,
    );
    await this.verificationCodes.verify(
      seller.id,
      'EMAIL_VERIFICATION',
      dto.code,
    );
    await this.prisma.seller.update({
      where: { id: seller.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async resendVerificationCode(email: string): Promise<void> {
    const seller = await this.prisma.seller.findUnique({ where: { email } });
    // Silent no-op for unknown/already-verified emails — don't reveal account
    // existence or state to whoever is calling this endpoint.
    if (!seller || seller.deletedAt || seller.emailVerifiedAt) return;
    const code = await this.verificationCodes.issue(
      seller.id,
      'EMAIL_VERIFICATION',
    );
    await this.mail.sendVerificationCode(seller.email, code);
  }

  /** Always succeeds from the caller's point of view — never reveals whether the email exists. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const seller = await this.prisma.seller.findUnique({
      where: { email: dto.email },
    });
    if (!seller || seller.deletedAt) return;
    const code = await this.verificationCodes.issue(
      seller.id,
      'PASSWORD_RESET',
    );
    await this.mail.sendPasswordResetCode(seller.email, code);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const seller = await this.findActiveSellerOrThrowGenericCodeError(
      dto.email,
    );
    await this.verificationCodes.verify(seller.id, 'PASSWORD_RESET', dto.code);

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });
    await this.prisma.seller.update({
      where: { id: seller.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    // A password reset invalidates every existing session — force re-login
    // everywhere, in case the reset was triggered because of a compromised
    // account.
    await this.sessions.deleteAllForSeller(seller.id);
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

    if (emailVerificationEnabled() && !seller.emailVerifiedAt) {
      throw new DomainException(
        'EMAIL_NOT_VERIFIED',
        'Devi prima confermare la tua email.',
        HttpStatus.FORBIDDEN,
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

  /**
   * Verification-code endpoints (verify-email, reset-password) must not
   * leak whether an email is registered via a different error than "bad
   * code" — an unknown email and a wrong code look identical to the caller.
   */
  private async findActiveSellerOrThrowGenericCodeError(email: string) {
    const seller = await this.prisma.seller.findUnique({ where: { email } });
    if (!seller || seller.deletedAt) {
      throw new DomainException(
        'VERIFICATION_CODE_INVALID',
        'Codice non valido o scaduto.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return seller;
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
