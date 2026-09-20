import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { DomainException } from '../common/domain-exception.js';
import type { VerificationCodePurpose } from '@prisma/client';
import {
  MAX_VERIFICATION_ATTEMPTS,
  VERIFICATION_CODE_RESEND_COOLDOWN_MS,
  VERIFICATION_CODE_TTL_MS,
} from './auth.constants.js';

/**
 * Shared 6-digit code issue/verify logic for both email verification and
 * password reset — same rules (TTL, attempt cap, resend cooldown), only the
 * purpose and what happens on success differ, which callers handle
 * themselves (AuthService).
 */
@Injectable()
export class VerificationCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the plaintext code — the only place it exists outside the caller's email. */
  async issue(
    sellerId: string,
    purpose: VerificationCodePurpose,
  ): Promise<string> {
    const recent = await this.prisma.verificationCode.findFirst({
      where: { sellerId, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (
      recent &&
      Date.now() - recent.createdAt.getTime() <
        VERIFICATION_CODE_RESEND_COOLDOWN_MS
    ) {
      throw new DomainException(
        'VERIFICATION_CODE_COOLDOWN',
        'Attendi qualche secondo prima di richiedere un nuovo codice.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });

    await this.prisma.verificationCode.create({
      data: {
        sellerId,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      },
    });

    return code;
  }

  /** Throws DomainException on any invalid/expired/exhausted code; returns void on success. */
  async verify(
    sellerId: string,
    purpose: VerificationCodePurpose,
    code: string,
  ): Promise<void> {
    const record = await this.prisma.verificationCode.findFirst({
      where: { sellerId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new DomainException(
        'VERIFICATION_CODE_INVALID',
        'Codice non valido o scaduto.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      throw new DomainException(
        'VERIFICATION_CODE_INVALID',
        'Codice non valido o scaduto.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const valid = await argon2.verify(record.codeHash, code);
    if (!valid) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new DomainException(
        'VERIFICATION_CODE_INVALID',
        'Codice non valido o scaduto.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }
}
