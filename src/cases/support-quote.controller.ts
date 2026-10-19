import {Body,Controller,Get,Header,Headers,Param,Post,Req,UseGuards} from '@nestjs/common';import {Throttle} from '@nestjs/throttler';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {SupportQuoteService} from './support-quote.service.js';import {SupportQuoteDto,SupportQuoteDecisionDto} from './support-quote.dto.js';
@Controller('cases/:id/support/tickets/:ticketId') @UseGuards(SessionAuthGuard)
export class SupportQuoteController {
 constructor(private readonly service:SupportQuoteService){}
 @Get('works/:workId/quotes') @Header('Cache-Control','no-store') list(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string){return this.service.list(r.seller.id,c,t,w);}
 @Post('works/:workId/quotes') issue(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Body()b:SupportQuoteDto){return this.service.issue(r.seller.id,c,t,w,b);}
 @Post('quotes/:quoteId/decision') decision(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('quoteId')q:string,@Body()b:SupportQuoteDecisionDto){return this.service.decide(r.seller.id,c,t,q,b);}
 @Get('quotes/:quoteId/pdf') @Header('Cache-Control','no-store') pdf(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('quoteId')q:string){return this.service.pdf(r.seller.id,c,t,q);}
}
@Controller('public-support/tickets/:ticketId/quotes')
export class PublicSupportQuoteController {
 constructor(private readonly service:SupportQuoteService){}
 @Get() @Header('Cache-Control','no-store') list(@Headers('x-support-token')token:string,@Param('ticketId')t:string){return this.service.publicList(token,t);}
 @Post(':quoteId/decision') @Throttle({default:{limit:10,ttl:60000}}) decide(@Headers('x-support-token')token:string,@Param('ticketId')t:string,@Param('quoteId')q:string,@Body()b:SupportQuoteDecisionDto){return this.service.decide(null,null,t,q,b,token);}
 @Get(':quoteId/pdf') @Header('Cache-Control','no-store') pdf(@Headers('x-support-token')token:string,@Param('ticketId')t:string,@Param('quoteId')q:string){return this.service.pdf(null,null,t,q,token);}
}
