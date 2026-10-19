import {Controller,Get,Post,Patch,Body,Param,Req,UseGuards} from '@nestjs/common';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {CasesService} from './cases.service.js';
import {CreateCaseDto,AddCaseItemDto,UpdateCaseItemDto,ArchiveCaseItemDto,CreateProposalDto} from './cases.dto.js';
@Controller('cases') @UseGuards(SessionAuthGuard)
export class CasesController {
 constructor(private readonly service:CasesService){}
 @Get() list(@Req() req:RequestWithSeller){return this.service.list(req.seller.id);}
 @Get(':id') get(@Req() req:RequestWithSeller,@Param('id') id:string){return this.service.get(req.seller.id,id);}
 @Get(':id/progress')progress(@Req() req:RequestWithSeller,@Param('id')id:string){return this.service.progress(req.seller.id,id);}
 @Post() create(@Req() req:RequestWithSeller,@Body() input:CreateCaseDto){return this.service.create(req.seller.id,input);}
 @Post(':id/items') add(@Req() req:RequestWithSeller,@Param('id') id:string,@Body() input:AddCaseItemDto){return this.service.add(req.seller.id,id,input);}
 @Patch(':id/items/:itemId')update(@Req()req:RequestWithSeller,@Param('id')id:string,@Param('itemId')item:string,@Body()b:UpdateCaseItemDto){return this.service.updateItem(req.seller.id,id,item,b);}
 @Post(':id/items/:itemId/archive')archive(@Req()req:RequestWithSeller,@Param('id')id:string,@Param('itemId')item:string,@Body()b:ArchiveCaseItemDto){return this.service.archiveItem(req.seller.id,id,item,b);}
 @Get(':id/proposals')proposals(@Req()req:RequestWithSeller,@Param('id')id:string){return this.service.proposals(req.seller.id,id);}
 @Post(':id/proposals')proposal(@Req()req:RequestWithSeller,@Param('id')id:string,@Body()b:CreateProposalDto){return this.service.proposal(req.seller.id,id,b);}

}
