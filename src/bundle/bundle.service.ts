import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  bundleSchema,
  type Bundle,
  type CatalogDatabase,
  type AssetManifestEntry,
} from '@pergolando/shared/schema';
import {
  PergolaEngine,
  ConfiguratoreError,
  type ConfiguraInput,
  type ConfigurazionePergola,
} from '@pergolando/shared/pricing-engine';
import { DomainException } from '../common/domain-exception.js';

/**
 * The primary bundle retains account and company branding. Additional product
 * catalogs are validated at boot and selected per request, with isolated pricing
 * engines; selecting a brand never changes another seller's active catalog.
 */
@Injectable()
export class BundleService implements OnModuleInit {
  private readonly logger = new Logger(BundleService.name);
  private bundle!: Bundle;
  private bundlePath!: string;
  private engine!: PergolaEngine;
  private additionalCatalogs = new Map<string, { bundle: Bundle; engine: PergolaEngine }>();

  async onModuleInit(): Promise<void> {
    const bundlePath = process.env.BUNDLE_PATH;
    if (!bundlePath) {
      throw new Error('BUNDLE_PATH environment variable is required.');
    }
    this.bundlePath = bundlePath;

    const [manifestRaw, databaseRaw, priceMatricesRaw, themeRaw] =
      await Promise.all([
        readFile(join(bundlePath, 'manifest.json'), 'utf-8'),
        readFile(join(bundlePath, 'catalog', 'database.json'), 'utf-8'),
        readFile(join(bundlePath, 'catalog', 'price_matrices.json'), 'utf-8'),
        readFile(join(bundlePath, 'branding', 'theme.json'), 'utf-8'),
      ]);

    // assets/manifest.json is optional — Studio's export only creates it
    // when the draft has at least one uploaded asset (see export-bundle.ts).
    const assetsManifestPath = join(bundlePath, 'assets', 'manifest.json');
    const assets = existsSync(assetsManifestPath)
      ? JSON.parse(await readFile(assetsManifestPath, 'utf-8'))
      : undefined;

    const candidate = {
      manifest: JSON.parse(manifestRaw),
      catalog: {
        database: JSON.parse(databaseRaw),
        price_matrices: JSON.parse(priceMatricesRaw),
      },
      branding: {
        theme: JSON.parse(themeRaw),
      },
      assets,
    };

    const result = bundleSchema.safeParse(candidate);
    if (!result.success) {
      this.logger.error(
        `Invalid bundle at ${bundlePath}: ${JSON.stringify(result.error.format())}`,
      );
      throw new Error(
        `Bundle at ${bundlePath} failed schema validation — refusing to start.`,
      );
    }

    this.bundle = result.data;
    this.engine = PergolaEngine.fromDatabase(
      this.bundle.catalog.database,
      this.bundle.catalog.price_matrices,
    );
    const praticPath = process.env.BUNDLE_PRATIC_PATH ?? join(bundlePath, '..', '..', 'brera-demo', '0.1.0');
    if (existsSync(join(praticPath, 'manifest.json'))) {
      const [manifest, database, matrices, theme] = await Promise.all([
        readFile(join(praticPath, 'manifest.json'), 'utf-8'),
        readFile(join(praticPath, 'catalog', 'database.json'), 'utf-8'),
        readFile(join(praticPath, 'catalog', 'price_matrices.json'), 'utf-8'),
        readFile(join(praticPath, 'branding', 'theme.json'), 'utf-8'),
      ]);
      const pratic = bundleSchema.parse({ manifest: JSON.parse(manifest), catalog: { database: JSON.parse(database), price_matrices: JSON.parse(matrices) }, branding: { theme: JSON.parse(theme) } });
      this.additionalCatalogs.set('pratic', { bundle: pratic, engine: PergolaEngine.fromDatabase(pratic.catalog.database, pratic.catalog.price_matrices) });
    }
    this.logger.log(
      `Loaded bundle for tenant "${this.bundle.manifest.tenant_id}" (schema ${this.bundle.manifest.schema_version}, bundle ${this.bundle.manifest.bundle_version}).`,
    );
  }

  private catalogEntry(id = 'arquati'): { bundle: Bundle; engine: PergolaEngine } {
    if (id === 'arquati') return { bundle: this.bundle, engine: this.engine };
    const entry = this.additionalCatalogs.get(id);
    if (!entry) throw new DomainException('CATALOGO_NON_DISPONIBILE', 'Catalogo non disponibile.', HttpStatus.BAD_REQUEST);
    return entry;
  }
  getCatalogs() {
    return [{ id: 'arquati', nome: 'Arquati', prodotto: this.bundle.catalog.database.prodotto.nome, renderingDisponibile: true }, ...Array.from(this.additionalCatalogs.entries()).map(([id, entry]) => ({ id, nome: 'Pratic', prodotto: entry.bundle.catalog.database.prodotto.nome, renderingDisponibile: true }))];
  }
  getCatalog(id = 'arquati'): CatalogDatabase { return this.catalogEntry(id).bundle.catalog.database; }

  getPriceMatrices(): Bundle['catalog']['price_matrices'] {
    return this.bundle.catalog.price_matrices;
  }

  getBranding(): Bundle['branding'] {
    return this.bundle.branding;
  }

  /** Absolute path to the logo file, or null if the bundle has none. */
  getLogoFilePath(): string | null {
    const logoPath = this.bundle.branding.theme.logo_path;
    if (!logoPath) return null;
    return join(this.bundlePath, logoPath);
  }

  /** Reference photos/renderings for this bundle's products (RenderService's raw material) — empty if Studio never uploaded any. */
  getAssets(): AssetManifestEntry[] {
    return this.bundle.assets ?? [];
  }

  /** Absolute path for an asset's manifest `path` (relative to the bundle root), same pattern as getLogoFilePath. */
  getAssetFilePath(relativePath: string): string {
    return join(this.bundlePath, relativePath);
  }

  getManifest(): Bundle['manifest'] {
    return this.bundle.manifest;
  }

  /**
   * Runs the pricing engine against this bundle's own catalog/price
   * matrices — a ConfiguratoreError (invalid dimensions, unknown color,
   * accessory not priced for this bucket, ...) becomes a 400 DomainException
   * with the engine's own message, same as every other domain error.
   */
  configura(input: ConfiguraInput, catalogId = 'arquati'): ConfigurazionePergola {
    try {
      return this.catalogEntry(catalogId).engine.configura(input);
    } catch (err) {
      if (err instanceof ConfiguratoreError) {
        throw new DomainException(
          'CONFIGURAZIONE_NON_VALIDA',
          err.message,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw err;
    }
  }
}
