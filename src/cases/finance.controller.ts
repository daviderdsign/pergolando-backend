import {Controller,Get,Post,Body,Param,Req,Res,UseGuards} from '@nestjs/common';import type {Response} from 'express';import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {FinanceService} from './finance.service.js';import {FinanceEntryDto,FinanceStateDto,FinanceDocumentDto} from './finance.dto.js';
@Controller('cases/:id/finance')@UseGuards(SessionAuthGuard)export class FinanceController{
 constructor(private readonly service:FinanceService){}
 @Get()get(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.get(r.seller.id,id);}
 @Post('entries')add(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:FinanceEntryDto){return this.service.add(r.seller.id,id,b);}
 @Post('state')state(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:FinanceStateDto){return this.service.state(r.seller.id,id,b);}
 @Post('documents')document(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:FinanceDocumentDto){return this.service.document(r.seller.id,id,b);}
 @Get('documents/:documentId')async download(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('documentId')documentId:string,@Res()res:Response){const doc=await this.service.download(r.seller.id,id,documentId);res.setHeader('Content-Type',doc.mimeType);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(doc.name).replace(/'/g,'%27')}`);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.send(Buffer.from(doc.data,'base64'));}
}
