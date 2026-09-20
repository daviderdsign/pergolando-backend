import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import { VerificationCodeService } from './verification-code.service.js';
import { DomainException } from '../common/domain-exception.js';
import type { SessionStore } from './session-store.interface.js';
import type { MailService } from '../mail/mail.service.js';

interface FakeSeller {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  deletedAt: Date | null;
}

interface FakeVerificationCode {
  id: string;
  sellerId: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

function makePrismaMock(seed: FakeSeller[] = []) {
  const sellers = new Map(seed.map((s) => [s.email, s]));
  const codes: FakeVerificationCode[] = [];
  let codeSeq = 0;

  return {
    seller: {
      findUnique: vi.fn(
        async ({ where }: { where: { email?: string; id?: string } }) => {
          if (where.email) return sellers.get(where.email) ?? null;
          if (where.id)
            return [...sellers.values()].find((s) => s.id === where.id) ?? null;
          return null;
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            email: string;
            passwordHash: string;
            emailVerifiedAt: Date | null;
          };
        }) => {
          const seller: FakeSeller = {
            id: `seller_${sellers.size + 1}`,
            email: data.email,
            passwordHash: data.passwordHash,
            emailVerifiedAt: data.emailVerifiedAt,
            failedLoginAttempts: 0,
            lockedUntil: null,
            deletedAt: null,
          };
          sellers.set(seller.email, seller);
          return seller;
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FakeSeller>;
        }) => {
          const seller = [...sellers.values()].find((s) => s.id === where.id)!;
          Object.assign(seller, data);
          return seller;
        },
      ),
    },
    verificationCode: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { sellerId: string; purpose: string; consumedAt?: null };
        }) => {
          const matches = codes
            .filter(
              (c) =>
                c.sellerId === where.sellerId &&
                c.purpose === where.purpose &&
                (where.consumedAt === undefined ||
                  c.consumedAt === where.consumedAt),
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return matches[0] ?? null;
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            sellerId: string;
            purpose: string;
            codeHash: string;
            expiresAt: Date;
          };
        }) => {
          const record: FakeVerificationCode = {
            id: `code_${++codeSeq}`,
            sellerId: data.sellerId,
            purpose: data.purpose,
            codeHash: data.codeHash,
            attempts: 0,
            expiresAt: data.expiresAt,
            consumedAt: null,
            createdAt: new Date(),
          };
          codes.push(record);
          return record;
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { attempts?: { increment: number }; consumedAt?: Date };
        }) => {
          const record = codes.find((c) => c.id === where.id)!;
          if (data.attempts) record.attempts += data.attempts.increment;
          if (data.consumedAt !== undefined)
            record.consumedAt = data.consumedAt;
          return record;
        },
      ),
    },
  };
}

function makeSessionStoreMock(): SessionStore {
  return {
    create: vi.fn(async (sellerId: string) => ({
      id: 'session_1',
      sellerId,
      expiresAt: new Date(Date.now() + 1000),
    })),
    find: vi.fn(async () => null),
    touch: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    deleteAllForSeller: vi.fn(async () => undefined),
  };
}

function makeMailMock(): MailService & {
  sentCodes: { to: string; code: string }[];
} {
  const sentCodes: { to: string; code: string }[] = [];
  return {
    sentCodes,
    sendVerificationCode: vi.fn(async (to: string, code: string) => {
      sentCodes.push({ to, code });
    }),
    sendPasswordResetCode: vi.fn(async (to: string, code: string) => {
      sentCodes.push({ to, code });
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let sessions: SessionStore;
  let mail: ReturnType<typeof makeMailMock>;
  let service: AuthService;

  function build() {
    prisma = makePrismaMock();
    sessions = makeSessionStoreMock();
    mail = makeMailMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verificationCodes = new VerificationCodeService(prisma as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(prisma as any, sessions, mail, verificationCodes);
  }

  afterEach(() => {
    delete process.env.EMAIL_VERIFICATION_ENABLED;
  });

  describe('with email verification disabled', () => {
    beforeEach(() => {
      process.env.EMAIL_VERIFICATION_ENABLED = 'false';
      build();
    });

    it('registers a seller with an Argon2id-hashed password, pre-verified', async () => {
      const { seller, verificationRequired } = await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      expect(seller.email).toBe('a@example.com');
      expect(verificationRequired).toBe(false);
      const stored = await prisma.seller.findUnique({
        where: { email: 'a@example.com' },
      });
      expect(stored?.emailVerifiedAt).not.toBeNull();
      expect(stored?.passwordHash).not.toBe('supersecret1');
      expect(await argon2.verify(stored!.passwordHash, 'supersecret1')).toBe(
        true,
      );
      expect(mail.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('rejects registering the same email twice', async () => {
      await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      await expect(
        service.register({
          email: 'a@example.com',
          password: 'other-password',
        }),
      ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
    });

    it('logs in immediately with correct credentials and creates a session', async () => {
      await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      const result = await service.login({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      expect(result.seller.email).toBe('a@example.com');
      expect(sessions.create).toHaveBeenCalledWith(result.seller.id);
    });

    it('rejects login with the wrong password', async () => {
      await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      await expect(
        service.login({ email: 'a@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(DomainException);
    });

    it('rejects login for an unknown email with the same error as a wrong password', async () => {
      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('with email verification enabled', () => {
    beforeEach(() => {
      process.env.EMAIL_VERIFICATION_ENABLED = 'true';
      build();
    });

    it('registers an unverified seller and sends a code, without a session', async () => {
      const { seller, verificationRequired } = await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      expect(verificationRequired).toBe(true);
      const stored = await prisma.seller.findUnique({
        where: { id: seller.id },
      });
      expect(stored?.emailVerifiedAt).toBeNull();
      expect(mail.sendVerificationCode).toHaveBeenCalledWith(
        'a@example.com',
        expect.any(String),
      );
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('rejects login before the email is verified', async () => {
      await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      await expect(
        service.login({ email: 'a@example.com', password: 'supersecret1' }),
      ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    });

    it('allows login after verifying with the correct code', async () => {
      await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      const { code } = mail.sentCodes[0]!;
      await service.verifyEmail({ email: 'a@example.com', code });

      const result = await service.login({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      expect(result.seller.email).toBe('a@example.com');
    });

    it('rejects verification with the wrong code', async () => {
      await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      await expect(
        service.verifyEmail({ email: 'a@example.com', code: '000000' }),
      ).rejects.toMatchObject({ code: 'VERIFICATION_CODE_INVALID' });
    });

    it('resets the password with a valid code and invalidates existing sessions', async () => {
      await service.register({
        email: 'a@example.com',
        password: 'supersecret1',
      });
      const { code: verifyCode } = mail.sentCodes[0]!;
      await service.verifyEmail({ email: 'a@example.com', code: verifyCode });

      mail.sentCodes.length = 0;
      await service.forgotPassword({ email: 'a@example.com' });
      const { code: resetCode } = mail.sentCodes[0]!;

      await service.resetPassword({
        email: 'a@example.com',
        code: resetCode,
        newPassword: 'brand-new-password',
      });

      expect(sessions.deleteAllForSeller).toHaveBeenCalled();
      const result = await service.login({
        email: 'a@example.com',
        password: 'brand-new-password',
      });
      expect(result.seller.email).toBe('a@example.com');
    });

    it('does not reveal whether an email is registered via forgotPassword', async () => {
      await expect(
        service.forgotPassword({ email: 'nobody@example.com' }),
      ).resolves.toBeUndefined();
      expect(mail.sendPasswordResetCode).not.toHaveBeenCalled();
    });
  });
});
