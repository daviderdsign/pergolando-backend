import {CatalogConversionService} from './conversion.service.js';
import {Controller,Get,Post,Patch,Delete,Body,Param,Req,Res,UseGuards,ParseIntPipe} from '@nestjs/common';import type {Response} from 'express';import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {DealerCatalogsService} from './catalogs.service.js';import {CatalogDeleteDto,CatalogDraftDto,CatalogUpdateDto,CatalogPriceDto,CatalogCheckDto,CatalogApproveDto,CatalogSourceDto,CatalogChunkDto,CatalogGenerateDto,CatalogReviewDto,CatalogAnswerDto,CatalogConfigurationDto} from './catalogs.dto.js';
@Controller('dealer-catalogs')@UseGuards(SessionAuthGuard)export class DealerCatalogsController{
 constructor(private readonly service:DealerCatalogsService,private readonly conversion:CatalogConversionService){}
 @Get()list(@Req()r:RequestWithSeller){return this.service.list(r.seller.id);}
 @Post()create(@Req()r:RequestWithSeller,@Body()b:CatalogDraftDto){return this.service.create(r.seller.id,b);}
 @Get(':id')get(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.get(r.seller.id,id);}
 @Delete(':id')remove(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogDeleteDto){return this.service.remove(r.seller.id,id,b);}
 @Patch(':id')update(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogUpdateDto){return this.service.update(r.seller.id,id,b);}
 @Post(':id/conversion')convert(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogGenerateDto){return this.conversion.start(r.seller.id,id,b.revision);}
 @Get(':id/conversion')conversionStatus(@Req()r:RequestWithSeller,@Param('id')id:string){return this.conversion.status(r.seller.id,id);}
 @Post(':id/answers')answer(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogAnswerDto){return this.conversion.answer(r.seller.id,id,b.revision,b.questionId,b.answer);}
 @Post(':id/configure')configure(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogConfigurationDto){return this.service.configure(r.seller.id,id,b);} @Post(':id/checks')check(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogCheckDto){return this.service.check(r.seller.id,id,b);}
 @Post(':id/trials')generate(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogGenerateDto){return this.service.generate(r.seller.id,id,b);}
 @Post(':id/trials/:checkId/review')review(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('checkId')checkId:string,@Body()b:CatalogReviewDto){return this.service.review(r.seller.id,id,checkId,b);} @Post(':id/approve')approve(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogApproveDto){return this.service.approve(r.seller.id,id,b);}
 @Post(':id/price')price(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogPriceDto){return this.service.price(r.seller.id,id,b);}
 @Post(':id/sources')begin(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CatalogSourceDto){return this.service.begin(r.seller.id,id,b);}
 @Post(':id/sources/:sourceId/parts/:part')part(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('sourceId')source:string,@Param('part',ParseIntPipe)part:number,@Body()b:CatalogChunkDto){return this.service.part(r.seller.id,id,source,part,b.data);}
 @Post(':id/sources/:sourceId/finish')finish(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('sourceId')source:string){return this.service.finish(r.seller.id,id,source);}
 @Get(':id/sources/:sourceId')async source(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('sourceId')source:string,@Res()res:Response){const doc=await this.service.source(r.seller.id,id,source);res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(doc.name).replace(/'/g,'%27')}`);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.send(Buffer.from(doc.data!,'base64'));}
}


