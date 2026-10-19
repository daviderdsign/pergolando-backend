import {SupportWorkService} from './support-work.service.js';
import {CreateSupportWorkDto,SupportWorkDto} from './support-work.dto.js';
import {SupportNotificationsService} from './support-notifications.service.js';
import {Body,Controller,Get,Header,Headers,Param,Post,Req,UseGuards} from '@nestjs/common';import {Throttle} from '@nestjs/throttler';import {Equals,IsString,Matches} from 'class-validator';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {CaseSupportService} from './support.service.js';import {CreateSupportTicketDto,SupportReplyDto,SupportUpdateDto} from './support.dto.js';
class RetryNoticeDto {@Equals(true) reviewed!:boolean;}
class InviteDto {@IsString() @Matches(/^[-\w]{43}$/) token!:string;@Equals(true) reviewed!:boolean;}
@Controller('cases/:id/support') @UseGuards(SessionAuthGuard)
export class CaseSupportController {
 constructor(private readonly service:CaseSupportService,private readonly notices:SupportNotificationsService,private readonly works:SupportWorkService){}
 @Get() @Header('Cache-Control','no-store') get(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.get(r.seller.id,id);}
 @Get('tickets/:ticketId/works') @Header('Cache-Control','no-store') listWorks(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('ticketId')t:string){return this.works.list(r.seller.id,id,t);}
 @Get('tickets/:ticketId/works/:workId/finance') @Header('Cache-Control','no-store') workFinance(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('ticketId')t:string,@Param('workId')w:string){return this.works.finance(r.seller.id,id,t,w);}
 @Post('tickets/:ticketId/works') createWork(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('ticketId')t:string,@Body()b:CreateSupportWorkDto){return this.works.create(r.seller.id,id,t,b);}
 @Post('tickets/:ticketId/works/:workId') saveWork(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('ticketId')t:string,@Param('workId')w:string,@Body()b:SupportWorkDto){return this.works.save(r.seller.id,id,t,w,b);}
 @Get('notifications') @Header('Cache-Control','no-store') noticesList(@Req()r:RequestWithSeller,@Param('id')id:string){return this.notices.list(r.seller.id,id);}
 @Post('notifications/:noticeId/retry') @Header('Cache-Control','no-store') retryNotice(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('noticeId')n:string,@Body()b:RetryNoticeDto){return this.notices.retry(r.seller.id,id,n,b.reviewed);}
 @Post('access') @Header('Cache-Control','no-store') @Throttle({default:{limit:3,ttl:60000}}) create(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.createAccess(r.seller.id,id);}
 @Post('access/:accessId/revoke') @Header('Cache-Control','no-store') revoke(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('accessId')a:string){return this.service.revoke(r.seller.id,id,a);}
 @Post('access/:accessId/send') @Header('Cache-Control','no-store') send(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('accessId')a:string,@Body()b:InviteDto){return this.service.invite(r.seller.id,id,a,b.token,b.reviewed);}
 @Post('tickets/:ticketId') @Header('Cache-Control','no-store') update(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('ticketId')t:string,@Body()b:SupportUpdateDto){return this.service.update(r.seller.id,id,t,b);}
 @Get('photos/:photoId') @Header('Cache-Control','no-store') photo(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('photoId')p:string){return this.service.photo(r.seller.id,id,p);}
}
@Controller('public-support')
export class PublicSupportController {
 constructor(private readonly service:CaseSupportService,private readonly notices:SupportNotificationsService,private readonly works:SupportWorkService){}
 @Get() @Header('Cache-Control','no-store') view(@Headers('x-support-token')t:string){return this.service.publicView(t);}
 @Post('tickets') @Header('Cache-Control','no-store') @Throttle({default:{limit:5,ttl:60000}}) create(@Headers('x-support-token')t:string,@Body()b:CreateSupportTicketDto){return this.service.createTicket(t,b);}
 @Post('tickets/:ticketId/reply') @Header('Cache-Control','no-store') @Throttle({default:{limit:10,ttl:60000}}) reply(@Headers('x-support-token')t:string,@Param('ticketId')id:string,@Body()b:SupportReplyDto){return this.service.reply(t,id,b);}
 @Get('photos/:photoId') @Header('Cache-Control','no-store') photo(@Headers('x-support-token')t:string,@Param('photoId')id:string){return this.service.publicPhoto(t,id);}
}





