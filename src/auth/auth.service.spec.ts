import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import { DomainException } from '../common/domain-exception.js';
import type { SessionStore } from './session-store.interface.js';

interface FakeSeller {
  id: string;
  email: string;
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  deletedAt: Date | null;
}

function makePrismaMock(seed: FakeSeller[] = []) {
  const sellers = new Map(seed.map((s) => [s.email, s]));
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
        async ({ data }: { data: { email: string; passwordHash: string } }) => {
          const seller: FakeSeller = {
            id: `seller_${sellers.size + 1}`,
            email: data.email,
            passwordHash: data.passwordHash,
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
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let sessions: SessionStore;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrismaMock();
    sessions = makeSessionStoreMock();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(prisma as any, sessions);
  });

  it('registers a seller with an Argon2id-hashed password', async () => {
    const result = await service.register({
      email: 'a@example.com',
      password: 'supersecret1',
    });
    expect(result.email).toBe('a@example.com');
    const stored = await prisma.seller.findUnique({
      where: { email: 'a@example.com' },
    });
    expect(stored?.passwordHash).not.toBe('supersecret1');
    expect(await argon2.verify(stored!.passwordHash, 'supersecret1')).toBe(
      true,
    );
  });

  it('rejects registering the same email twice', async () => {
    await service.register({
      email: 'a@example.com',
      password: 'supersecret1',
    });
    await expect(
      service.register({ email: 'a@example.com', password: 'other-password' }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('logs in with correct credentials and creates a session', async () => {
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
