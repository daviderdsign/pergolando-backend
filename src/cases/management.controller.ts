import {Body,Controller,Get,Param,Patch,Post,Req,UseGuards} from '@nestjs/common';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {CaseManagementService,UpdateCustomerDto,CreateActivityDto,CompleteActivityDto} from './management.service.js';
@Controller('cases')@UseGuards(SessionAuthGuard)export class CaseManagementController{
 constructor(private readonly service:CaseManagementService){}
 @Patch(':id/customer')customer(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:UpdateCustomerDto){return this.service.customer(r.seller.id,id,b);}
 @Get(':id/activities')list(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.list(r.seller.id,id);}
 @Post(':id/activities')add(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CreateActivityDto){return this.service.add(r.seller.id,id,b);}
 @Post(':id/activities/:activityId/status')complete(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('activityId')activity:string,@Body()b:CompleteActivityDto){return this.service.complete(r.seller.id,id,activity,b);}
}
