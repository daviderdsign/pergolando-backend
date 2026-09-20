import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Each suite spawns a synchronous `pnpm exec prisma migrate deploy`
    // child process in beforeAll — under load that can take longer than
    // the default hook timeout.
    hookTimeout: 30_000,
  },
});
