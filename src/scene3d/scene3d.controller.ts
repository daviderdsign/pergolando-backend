import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Scene3dService } from './scene3d.service.js';
import { RenderScene3dDto } from './dto/render-scene3d.dto.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';

@Controller()
export class Scene3dController {
  constructor(private readonly scene3dService: Scene3dService) {}

  @UseGuards(SessionAuthGuard)
  @Post('catalog/render3d')
  @HttpCode(HttpStatus.OK)
  async render(@Body() dto: RenderScene3dDto) {
    return this.scene3dService.render(dto);
  }
}
