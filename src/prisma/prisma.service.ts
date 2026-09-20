import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

/**
 * DATABASE_URL keeps the familiar "file:./path" form for `prisma migrate`
 * (configured in prisma.config.ts), but the better-sqlite3 driver adapter
 * used at runtime takes a raw filesystem path — strip the prefix here.
 */
function sqliteFilePath(databaseUrl: string): string {
  return databaseUrl.startsWith('file:')
    ? databaseUrl.slice('file:'.length)
    : databaseUrl;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required.');
    }
    super({
      adapter: new PrismaBetterSqlite3({ url: sqliteFilePath(databaseUrl) }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
