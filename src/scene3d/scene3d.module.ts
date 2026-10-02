import { Module } from '@nestjs/common';
import { Scene3dController } from './scene3d.controller.js';
import { Scene3dService } from './scene3d.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [Scene3dController],
  providers: [Scene3dService],
  exports: [Scene3dService],
})
export class Scene3dModule {}
