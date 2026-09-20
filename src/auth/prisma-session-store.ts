import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionStore, StoredSession } from './session-store.interface.js';
import { SESSION_TTL_MS } from './auth.constants.js';

@Injectable()
export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(sellerId: string): Promise<StoredSession> {
    const session = await this.prisma.session.create({
      data: { sellerId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    return session;
  }

  async find(sessionId: string): Promise<StoredSession | null> {
    return this.prisma.session.findUnique({ where: { id: sessionId } });
  }

  async touch(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }

  async delete(sessionId: string): Promise<void> {
    await this.prisma.session
      .delete({ where: { id: sessionId } })
      .catch(() => undefined);
  }

  async deleteAllForSeller(sellerId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { sellerId } });
  }
}
