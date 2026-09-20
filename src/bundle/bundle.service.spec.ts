import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BundleService } from './bundle.service.js';

async function writeBundle(
  dir: string,
  overrides: { database?: unknown } = {},
) {
  await mkdir(join(dir, 'catalog'), { recursive: true });
  await mkdir(join(dir, 'branding'), { recursive: true });
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({
      tenant_id: 't',
      nome_azienda: 'T',
      bundle_version: '0.1.0',
      data_export: '2026-01-01T00:00:00.000Z',
      schema_version: '1.0.0',
    }),
  );
  await writeFile(
    join(dir, 'catalog', 'database.json'),
    JSON.stringify(
      overrides.database ?? {
        prodotto: { nome: 'X' } /* missing required fields */,
      },
    ),
  );
  await writeFile(
    join(dir, 'catalog', 'price_matrices.json'),
    JSON.stringify({}),
  );
  await writeFile(
    join(dir, 'branding', 'theme.json'),
    JSON.stringify({ nome_azienda: 'T', palette: { primario: '#000' } }),
  );
}

describe('BundleService', () => {
  let dir: string;
  const originalEnv = process.env.BUNDLE_PATH;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pergolando-bundle-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    process.env.BUNDLE_PATH = originalEnv;
  });

  it('refuses to start with a bundle that fails schema validation', async () => {
    await writeBundle(dir);
    process.env.BUNDLE_PATH = dir;

    const service = new BundleService();
    await expect(service.onModuleInit()).rejects.toThrow(
      /failed schema validation/,
    );
  });

  it('throws if BUNDLE_PATH is not set', async () => {
    delete process.env.BUNDLE_PATH;
    const service = new BundleService();
    await expect(service.onModuleInit()).rejects.toThrow(/BUNDLE_PATH/);
  });
});
