import {Body,Controller,Get,Headers,Param,Post,Req,UseGuards,Header} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {ProposalInvitationsService} from './invitations.service.js';
import {AcceptProposalDto,DecideProposalDto,OfferCodeRequestDto} from './invitations.dto.js';
@Controller('cases')@UseGuards(SessionAuthGuard)export class ProposalInvitationsController{
 constructor(private readonly service:ProposalInvitationsService){}
 @Get(':id/invitations')list(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.list(r.seller.id,id);}
 @Post(':id/proposals/:proposalId/invitations')@Header('Cache-Control','no-store')create(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('proposalId')proposal:string){return this.service.create(r.seller.id,id,proposal);}
 @Post(':id/invitations/:invitationId/revoke')revoke(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('invitationId')invitation:string){return this.service.revoke(r.seller.id,id,invitation);}
 @Post(':id/invitations/:invitationId/confirm')confirm(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('invitationId')invitation:string,@Body()body:DecideProposalDto){return this.service.decide(r.seller.id,id,invitation,true,body.note);}
 @Post(':id/invitations/:invitationId/reject')reject(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('invitationId')invitation:string,@Body()body:DecideProposalDto){return this.service.decide(r.seller.id,id,invitation,false,body.note);}
}
@Controller('public-offer')export class PublicOfferController{
 constructor(private readonly service:ProposalInvitationsService){}
 @Get()@Header('Cache-Control','no-store')view(@Headers('x-offer-token')token:string){return this.service.view(token);}
 @Get('media/:id')@Header('Cache-Control','no-store')media(@Headers('x-offer-token')token:string,@Param('id')id:string){return this.service.media(token,id);}
 @Post('code')@Throttle({default:{limit:3,ttl:60000}})@Header('Cache-Control','no-store')code(@Headers('x-offer-token')token:string,@Body()body:OfferCodeRequestDto){return this.service.requestCode(token,body.email);}
 @Post('accept')@Throttle({default:{limit:8,ttl:60000}})@Header('Cache-Control','no-store')accept(@Headers('x-offer-token')token:string,@Body()body:AcceptProposalDto){return this.service.accept(token,body);}
}
