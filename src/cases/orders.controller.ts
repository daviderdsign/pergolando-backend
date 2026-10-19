import {Body,Controller,Get,Param,Post,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {CaseOrdersService} from './orders.service.js';
import {PrepareOrdersDto,OrderPreviewDto,SendOrderDto,SupplierOrderEventDto} from './orders.dto.js';
@Controller('cases/:id/orders') @UseGuards(SessionAuthGuard)
export class CaseOrdersController {
 constructor(private readonly service:CaseOrdersService){}
 @Get() get(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.get(r.seller.id,id);}
 @Post() prepare(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:PrepareOrdersDto){return this.service.prepare(r.seller.id,id,b);}
 @Get(':batch/:index/pdf') async pdf(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('batch')batch:string,@Param('index')index:string,@Res()res:Response){const bytes=await this.service.document(r.seller.id,id,batch,Number(index));res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Disposition','attachment; filename="Ordine-produttore.pdf"');res.setHeader('X-Content-Type-Options','nosniff');res.send(bytes);}
 @Post(':batch/email-preview') preview(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('batch')batch:string,@Body()b:OrderPreviewDto){return this.service.preview(r.seller.id,id,batch,b);}
 @Post(':batch/send') send(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('batch')batch:string,@Body()b:SendOrderDto){return this.service.send(r.seller.id,id,batch,b);}
 @Post(':batch/events') event(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('batch')batch:string,@Body()b:SupplierOrderEventDto){return this.service.event(r.seller.id,id,batch,b);}
}
