import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PerspectiveService } from './perspective.service.js';
import { CalcolaProspettivaDto } from './dto/calcola-prospettiva.dto.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';

@Controller()
export class PerspectiveController {
  constructor(private readonly perspectiveService: PerspectiveService) {}

  @UseGuards(SessionAuthGuard)
  @Post('catalog/perspective')
  @HttpCode(HttpStatus.OK)
  async calcolaProspettiva(@Body() dto: CalcolaProspettivaDto) {
    return this.perspectiveService.calcolaProspettiva(dto);
  }
}
