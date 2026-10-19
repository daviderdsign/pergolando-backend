import {Controller,Get,Post,Put,Body,Req,UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {SetupService} from './setup.service.js';
import {SetupAcceptDto,SetupSaveDto,SetupFinishDto} from './setup.dto.js';
@Controller('setup')@UseGuards(SessionAuthGuard)export class SetupController{
 constructor(private service:SetupService){}
 @Get()get(@Req()r:RequestWithSeller){return this.service.status(r.seller.id);}
 @Post('agreement')accept(@Req()r:RequestWithSeller,@Body()b:SetupAcceptDto){return this.service.accept(r.seller.id,b);}
 @Put()save(@Req()r:RequestWithSeller,@Body()b:SetupSaveDto){return this.service.save(r.seller.id,b);}
 @Post('mail-test')@Throttle({default:{limit:3,ttl:60000}})mail(@Req()r:RequestWithSeller){return this.service.testMail(r.seller.id);}
 @Post('complete')complete(@Req()r:RequestWithSeller,@Body()b:SetupFinishDto){return this.service.finish(r.seller.id,b);}
}
