import {Body,Controller,Param,Patch,Post,Req,UseGuards} from '@nestjs/common';
import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {ImportedCaseItemsService} from './imported-items.service.js';
import {ImportedCaseItemDto,UpdateImportedCaseItemDto} from './imported-items.dto.js';
@Controller('cases')@UseGuards(SessionAuthGuard)export class ImportedCaseItemsController{
 constructor(private readonly service:ImportedCaseItemsService){}
 @Post(':id/imported-items')add(@Req()r:RequestWithSeller,@Param('id')id:string,@Body()b:ImportedCaseItemDto){return this.service.add(r.seller.id,id,b);}
 @Patch(':id/imported-items/:itemId')update(@Req()r:RequestWithSeller,@Param('id')id:string,@Param('itemId')item:string,@Body()b:UpdateImportedCaseItemDto){return this.service.update(r.seller.id,id,item,b);}
}
