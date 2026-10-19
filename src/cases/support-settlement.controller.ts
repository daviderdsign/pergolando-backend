import {Body,Controller,Get,Header,Param,Post,Req,UseGuards} from '@nestjs/common';import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {SupportSettlementService} from './support-settlement.service.js';import {SupportSettlementDto} from './support-settlement.dto.js';
@Controller('cases/:id/support/tickets/:ticketId/works/:workId/settlements') @UseGuards(SessionAuthGuard)
export class SupportSettlementController {
 constructor(private readonly service:SupportSettlementService){}
 @Get() @Header('Cache-Control','no-store') get(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string){return this.service.get(r.seller.id,c,t,w);}
 @Post() record(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Body()b:SupportSettlementDto){return this.service.record(r.seller.id,c,t,w,b);}
}
