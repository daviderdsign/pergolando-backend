import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RenderService } from './render.service.js';
import { RenderFinaleService } from './render-finale.service.js';
import { ConfiguraDto } from '../bundle/dto/configura.dto.js';
import { RenderFinaleDto } from './dto/render-finale.dto.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';

@Controller()
export class RenderController {
  constructor(
    private readonly renderService: RenderService,
    private readonly renderFinaleService: RenderFinaleService,
  ) {}

  /**
   * Same input shape as POST catalog/configura — a render is generated for
   * the exact configuration being priced, not a separate concept.
   */
  @UseGuards(SessionAuthGuard)
  @Post('catalog/render')
  @HttpCode(HttpStatus.OK)
  async render(@Body() dto: ConfiguraDto) {
    return this.renderService.render(dto);
  }

  /** Step 6 of the "compose on a real photo" pipeline — see
   * RenderFinaleService/buildCompositePrompt. */
  @UseGuards(SessionAuthGuard)
  @Post('catalog/render-finale')
  @HttpCode(HttpStatus.OK)
  async renderFinale(@Body() dto: RenderFinaleDto) {
    return this.renderFinaleService.renderFinale(dto);
  }
}
