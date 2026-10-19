import {
  Body,
  Get,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PerspectiveService } from './perspective.service.js';
import { CalcolaProspettivaDto, AnalizzaFotoDto } from './dto/calcola-prospettiva.dto.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';

@Controller()
export class PerspectiveController {
  constructor(private readonly perspectiveService: PerspectiveService) {}

  @UseGuards(SessionAuthGuard)
  @Get('catalog/services/status')
  async servicesStatus() {
    const check = async (name: string, url?: string) => {
      if (!url) return {name, ready:false, message:'Servizio non configurato'};
      try {
        const response = await fetch(new URL('/health', url), {signal:AbortSignal.timeout(5000)});
        const body = response.ok ? await response.json() as {status?:string} : null;
        const ready = response.ok && body?.status === 'ok';
        return {name, ready, message:ready ? 'Pronto' : 'Servizio non pronto'};
      } catch {return {name, ready:false, message:'Non raggiungibile dal server'};}
    };
    const [geocalib, blender] = await Promise.all([check('GeoCalib',process.env.GEOCALIB_SERVICE_URL),check('Blender',process.env.BLENDER_SERVICE_URL)]);
    return {geocalib, blender};
  }

  @UseGuards(SessionAuthGuard)
  @Post('catalog/perspective/auto')
  @HttpCode(HttpStatus.OK)
  async analizzaFoto(@Body() dto: AnalizzaFotoDto) {
    return this.perspectiveService.analizzaFoto(dto.fotoBase64);
  }

  @UseGuards(SessionAuthGuard)
  @Post('catalog/perspective')
  @HttpCode(HttpStatus.OK)
  async calcolaProspettiva(@Body() dto: CalcolaProspettivaDto) {
    return this.perspectiveService.calcolaProspettiva(dto);
  }
}
