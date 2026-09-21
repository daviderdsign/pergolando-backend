import { createReadStream, existsSync } from 'node:fs';
import { extname } from 'node:path';
import {
  Controller,
  Get,
  NotFoundException,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { BundleService } from './bundle.service.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

@Controller()
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  /** Products/sotto-modelli/varianti/colori — no prices yet (that's the next slice). */
  @UseGuards(SessionAuthGuard)
  @Get('catalog')
  getCatalog() {
    return { catalog: this.bundleService.getCatalog() };
  }

  /**
   * Public (no session): the login/register pages need the tenant's branding
   * before the seller has authenticated.
   */
  @Get('branding')
  getBranding() {
    return { branding: this.bundleService.getBranding() };
  }

  @Get('branding/logo')
  getLogo(): StreamableFile {
    const path = this.bundleService.getLogoFilePath();
    if (!path || !existsSync(path)) {
      throw new NotFoundException('Nessun logo configurato per questo bundle.');
    }
    return new StreamableFile(createReadStream(path), {
      type:
        CONTENT_TYPES[extname(path).toLowerCase()] ??
        'application/octet-stream',
    });
  }
}
