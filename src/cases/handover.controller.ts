import {Body,Controller,Get,Param,Post,Req,Res,UseGuards} from '@nestjs/common';import type {Response} from 'express';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {CaseHandoverService} from './handover.service.js';import {HandoverDto} from './handover.dto.js';
@Controller('cases/:id/handovers') @UseGuards(SessionAuthGuard)
export class CaseHandoverController {
 constructor(private readonly service:CaseHandoverService){}
 @Get() get(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.get(r.seller.id,id);}
 @Post() save(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:HandoverDto){return this.service.save(r.seller.id,id,b);}
 @Get(':eventId/pdf') async pdf(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('eventId')eventId:string,@Res()res:Response){const pdf=await this.service.document(r.seller.id,id,eventId);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="Verbale-consegna.pdf"');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.send(pdf);}
}
