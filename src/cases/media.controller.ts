import {Controller,Get,Post,Body,Param,Req,UseGuards} from '@nestjs/common';import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {CaseMediaService} from './media.service.js';import {CaseMediaDto} from './media.dto.js';
@Controller('cases/:id')@UseGuards(SessionAuthGuard)export class CaseMediaController{
 constructor(private readonly service:CaseMediaService){}
 @Post('items/:itemId/media')save(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('itemId')itemId:string,@Body()b:CaseMediaDto){return this.service.save(r.seller.id,id,itemId,b);}
 @Get('media/:mediaId')get(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('mediaId')mediaId:string){return this.service.get(r.seller.id,id,mediaId);}
}
