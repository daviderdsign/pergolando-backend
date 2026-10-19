import {Body,Controller,Get,Param,Post,Req,UseGuards} from '@nestjs/common';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {CaseInstallationService} from './installation.service.js';
import {InstallationDto} from './installation.dto.js';
@Controller('cases/:id/installation') @UseGuards(SessionAuthGuard)
export class CaseInstallationController {
 constructor(private readonly service:CaseInstallationService){}
 @Get() get(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.get(r.seller.id,id);}
 @Post() save(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:InstallationDto){return this.service.save(r.seller.id,id,b);}
}
