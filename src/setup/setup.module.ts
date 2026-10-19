import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module.js';
import {BundleModule} from '../bundle/bundle.module.js';
import {SetupController} from './setup.controller.js';
import {SetupService,SetupMailTransport} from './setup.service.js';
@Module({imports:[AuthModule,BundleModule],controllers:[SetupController],providers:[SetupService,SetupMailTransport],exports:[SetupService]})export class SetupModule{}
