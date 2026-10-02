import { Module } from '@nestjs/common';
import { PerspectiveController } from './perspective.controller.js';
import { PerspectiveService } from './perspective.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [PerspectiveController],
  providers: [PerspectiveService],
})
export class PerspectiveModule {}
