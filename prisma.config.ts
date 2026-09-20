import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

// Used by `prisma migrate`/`prisma generate` only. The running app's
// PrismaClient connects via a driver adapter (src/prisma/prisma.service.ts),
// not this file — Prisma 7 keeps the two configurations separate.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
