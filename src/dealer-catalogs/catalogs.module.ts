import {CatalogConversionService,CatalogConversionTransport} from './conversion.service.js';
import {Module} from '@nestjs/common';import {AuthModule} from '../auth/auth.module.js';import {DealerCatalogsController} from './catalogs.controller.js';import {DealerCatalogsService} from './catalogs.service.js';
@Module({imports:[AuthModule],controllers:[DealerCatalogsController],providers:[CatalogConversionService,CatalogConversionTransport,DealerCatalogsService],exports:[DealerCatalogsService]})export class DealerCatalogsModule{}

