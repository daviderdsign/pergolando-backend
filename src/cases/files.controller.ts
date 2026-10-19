import {Controller,Get,Post,Delete,Param,Req,Body,Res,UseGuards} from '@nestjs/common';import type {Response} from 'express';import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';import {CaseFilesService,CaseFileDto} from './files.service.js';
@Controller('cases/:id/files')@UseGuards(SessionAuthGuard)export class CaseFilesController{
 constructor(private service:CaseFilesService){}
 @Get()list(@Req()r:RequestWithSeller,@Param('id')id:string){return this.service.list(r.seller.id,id);}
 @Post()add(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:CaseFileDto){return this.service.add(r.seller.id,id,b);}
 @Delete(':fileId')remove(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('fileId')fileId:string){return this.service.remove(r.seller.id,id,fileId);}
 @Get(':fileId')async get(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('fileId')fileId:string,@Res()res:Response){const f=await this.service.get(r.seller.id,id,fileId);res.setHeader('Content-Type',f.mimeType);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.name).replace(/'/g,'%27')}`);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.send(Buffer.from(f.data,'base64'));}
}
