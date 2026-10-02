import { Module } from '@nestjs/common';
import { RenderController } from './render.controller.js';
import { RenderService } from './render.service.js';
import { RenderFinaleService } from './render-finale.service.js';
import { BundleModule } from '../bundle/bundle.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { Scene3dModule } from '../scene3d/scene3d.module.js';

@Module({
  imports: [BundleModule, AuthModule, Scene3dModule],
  controllers: [RenderController],
  providers: [RenderService, RenderFinaleService],
})
export class RenderModule {}
