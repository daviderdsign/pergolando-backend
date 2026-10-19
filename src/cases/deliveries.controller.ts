import {Body,Controller,Get,Header,Param,Post,Req,Res,UseGuards} from '@nestjs/common';import type {Response} from 'express';
import {IsString,Matches} from 'class-validator';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {ProposalDeliveriesService,SendProposalDto} from './deliveries.service.js';
class PreviewDto{@IsString()@Matches(/^[A-Za-z0-9_-]{43}$/) invitationToken!:string;}
@Controller('cases')@UseGuards(SessionAuthGuard)export class ProposalDeliveriesController{
 constructor(private readonly service:ProposalDeliveriesService){}
 @Get('proposal-mail-status')status(){return this.service.status();}
 @Get(':id/proposals/:proposalId/deliveries')list(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('proposalId')proposal:string){return this.service.list(r.seller.id,id,proposal);}
 @Post(':id/proposals/:proposalId/email-preview')@Header('Cache-Control','no-store')preview(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('proposalId')proposal:string,@Body()body:PreviewDto){return this.service.preview(r.seller.id,id,proposal,body.invitationToken);}
 @Post(':id/proposals/:proposalId/send')send(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('proposalId')proposal:string,@Body()body:SendProposalDto){return this.service.send(r.seller.id,id,proposal,body);}
 @Get(':id/proposals/:proposalId/deliveries/:deliveryId/pdf')async pdf(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('proposalId')proposal:string,@Param('deliveryId')delivery:string,@Res()res:Response){const value=await this.service.document(r.seller.id,id,proposal,delivery);res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Disposition','attachment; filename="Preventivo-archiviato.pdf"');res.setHeader('X-Content-Type-Options','nosniff');res.send(Buffer.from(value.pdf,'base64'));}
}
