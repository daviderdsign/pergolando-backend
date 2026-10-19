import {Body,Controller,Get,Param,Post,Req,UseGuards,ConflictException} from '@nestjs/common';import {Equals} from 'class-validator';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {CasesService} from './cases.service.js';import {PrismaService} from '../prisma/prisma.service.js';
class RetryNoticeDto{@Equals(true) checked!:boolean;}
@Controller('cases')@UseGuards(SessionAuthGuard)export class CaseNotificationsController{
 constructor(private readonly db:PrismaService,private readonly cases:CasesService){}
 @Get(':id/notifications')async list(@Req()r:RequestWithSeller,@Param('id')id:string){await this.cases.get(r.seller.id,id);return this.db.caseNotification.findMany({where:{caseId:id},orderBy:{createdAt:'desc'}});}
 @Post(':id/notifications/:noticeId/retry')async retry(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('noticeId')notice:string,@Body()body:RetryNoticeDto){await this.cases.get(r.seller.id,id);if(!body.checked)throw new ConflictException('Controlla prima l’esito nella casella.');const changed=await this.db.caseNotification.updateMany({where:{id:notice,caseId:id,status:{in:['FAILED','UNKNOWN']},recipient:{not:''}},data:{status:'PENDING',errorCode:null,completedAt:null}});if(!changed.count)throw new ConflictException('Notifica non ripetibile o già in coda.');return {queued:true};}
}
