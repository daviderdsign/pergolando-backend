import {Controller,Get,Post,Body,Param,Req,UseGuards} from '@nestjs/common';import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {CasePaymentsService} from './payments.service.js';import {PaymentCheckDto} from './payments.dto.js';
@Controller('cases/:id/payments')@UseGuards(SessionAuthGuard)export class CasePaymentsController{
 constructor(private readonly service:CasePaymentsService){}
 @Get()get(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.get(r.seller.id,id);}
 @Post('checks')check(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:PaymentCheckDto){return this.service.check(r.seller.id,id,b);}
}
