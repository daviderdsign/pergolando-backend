export interface StoredSession {
  id: string;
  sellerId: string;
  expiresAt: Date;
}

/**
 * Abstracted so the sliding-expiry/regenerate-on-login rules live in one
 * place and aren't tied to Prisma specifically (SOLID: AuthService depends
 * on this interface, not on the ORM).
 */
export interface SessionStore {
  create(sellerId: string): Promise<StoredSession>;
  find(sessionId: string): Promise<StoredSession | null>;
  /** Sliding expiry: extends expiresAt by the session TTL. */
  touch(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

export const SESSION_STORE = Symbol('SESSION_STORE');
