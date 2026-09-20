import { Controller, Get, UseGuards } from '@nestjs/common';
import { BundleService } from './bundle.service.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';

@UseGuards(SessionAuthGuard)
@Controller()
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  /** Products/sotto-modelli/varianti/colori — no prices yet (that's the next slice). */
  @Get('catalog')
  getCatalog() {
    return { catalog: this.bundleService.getCatalog() };
  }

  @Get('branding')
  getBranding() {
    return { branding: this.bundleService.getBranding() };
  }
}
