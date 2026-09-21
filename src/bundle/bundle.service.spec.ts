import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BundleService } from './bundle.service.js';
import { DomainException } from '../common/domain-exception.js';

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

describe('BundleService#configura', () => {
  const service = new BundleService();

  beforeEach(async () => {
    process.env.BUNDLE_PATH = join(process.cwd(), 'test', 'fixtures', 'bundle');
    await service.onModuleInit();
  });

  it('runs the pricing engine against this bundle and returns a price', () => {
    const result = service.configura({
      sottoModello: 'P',
      varianteMontaggio: '01L',
      pRichiestaCm: 300,
      lRichiestaCm: 200,
      coloreStruttura: 'RAL 9016 Bianco sablé',
      colorePlastica: 'Bianco',
      altezzaMontantiCm: 200,
      opzioneTecnica: 'H20',
    });
    expect(result.prezzo_totale_eur).toBe(9290);
  });

  it('turns a ConfiguratoreError into a DomainException (400, CONFIGURAZIONE_NON_VALIDA)', () => {
    try {
      service.configura({
        sottoModello: 'nonEsiste',
        varianteMontaggio: '01L',
        pRichiestaCm: 300,
        lRichiestaCm: 200,
        coloreStruttura: 'RAL 9016 Bianco sablé',
        colorePlastica: 'Bianco',
        altezzaMontantiCm: 200,
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      expect((err as DomainException).code).toBe('CONFIGURAZIONE_NON_VALIDA');
      expect((err as DomainException).getStatus()).toBe(400);
    }
  });
});
