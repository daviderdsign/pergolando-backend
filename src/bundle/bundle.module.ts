import { Module } from '@nestjs/common';
import { BundleController } from './bundle.controller.js';
import { BundleService } from './bundle.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [BundleController],
  providers: [BundleService],
  exports: [BundleService],
})
export class BundleModule {}
