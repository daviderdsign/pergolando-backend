import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  bundleSchema,
  type Bundle,
  type CatalogDatabase,
} from '@pergolando/shared/schema';

/**
 * Loads and validates this deployment's single bundle at boot from
 * BUNDLE_PATH — one tenant per deployment, so there is exactly one bundle
 * for the process's whole lifetime, not a per-request lookup. An invalid
 * bundle fails startup rather than serving broken data.
 */
@Injectable()
export class BundleService implements OnModuleInit {
  private readonly logger = new Logger(BundleService.name);
  private bundle!: Bundle;

  async onModuleInit(): Promise<void> {
    const bundlePath = process.env.BUNDLE_PATH;
    if (!bundlePath) {
      throw new Error('BUNDLE_PATH environment variable is required.');
    }

    const [manifestRaw, databaseRaw, priceMatricesRaw, themeRaw] =
      await Promise.all([
        readFile(join(bundlePath, 'manifest.json'), 'utf-8'),
        readFile(join(bundlePath, 'catalog', 'database.json'), 'utf-8'),
        readFile(join(bundlePath, 'catalog', 'price_matrices.json'), 'utf-8'),
        readFile(join(bundlePath, 'branding', 'theme.json'), 'utf-8'),
      ]);

    const candidate = {
      manifest: JSON.parse(manifestRaw),
      catalog: {
        database: JSON.parse(databaseRaw),
        price_matrices: JSON.parse(priceMatricesRaw),
      },
      branding: {
        theme: JSON.parse(themeRaw),
      },
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
    this.logger.log(
      `Loaded bundle for tenant "${this.bundle.manifest.tenant_id}" (schema ${this.bundle.manifest.schema_version}, bundle ${this.bundle.manifest.bundle_version}).`,
    );
  }

  getCatalog(): CatalogDatabase {
    return this.bundle.catalog.database;
  }

  getPriceMatrices(): Bundle['catalog']['price_matrices'] {
    return this.bundle.catalog.price_matrices;
  }

  getBranding(): Bundle['branding'] {
    return this.bundle.branding;
  }

  getManifest(): Bundle['manifest'] {
    return this.bundle.manifest;
  }
}
