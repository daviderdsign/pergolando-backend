import {SupportPartDocumentService} from './support-part-document.service.js';import {PartDocumentDto} from './support-part-document.dto.js';
import {Body,Controller,Get,Header,Param,Post,Req,UseGuards} from '@nestjs/common';import {SessionAuthGuard,type RequestWithSeller} from '../auth/guards/session-auth.guard.js';
import {SupportPartOrderService} from './support-part-order.service.js';import {CreatePartOrderDto,PartOrderEventDto} from './support-part-order.dto.js';
import {SupportPartOrderMailService} from './support-part-order-mail.service.js';import {PartOrderMailPreviewDto,PartOrderMailSendDto,PartOrderMailResolutionDto} from './support-part-order-mail.dto.js';
@Controller('cases/:id/support/tickets/:ticketId/works/:workId/part-orders') @UseGuards(SessionAuthGuard)
export class SupportPartOrderController {
 constructor(private readonly service:SupportPartOrderService,private readonly mail:SupportPartOrderMailService,private readonly documents:SupportPartDocumentService){}
 @Get(':orderId/documents') @Header('Cache-Control','no-store') documentsList(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string){return this.documents.list(r.seller.id,c,t,w,o);}
 @Post(':orderId/documents') documentSave(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string,@Body()b:PartDocumentDto){return this.documents.save(r.seller.id,c,t,w,o,b);}
 @Get(':orderId/email') @Header('Cache-Control','no-store') history(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string){return this.mail.history(r.seller.id,c,t,w,o);}
 @Post(':orderId/email/preview') @Header('Cache-Control','no-store') preview(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string,@Body()b:PartOrderMailPreviewDto){return this.mail.preview(r.seller.id,c,t,w,o,b.recipient);}
 @Post(':orderId/email/send') @Header('Cache-Control','no-store') send(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string,@Body()b:PartOrderMailSendDto){return this.mail.send(r.seller.id,c,t,w,o,b);}
 @Post(':orderId/email/:deliveryId/resolve') @Header('Cache-Control','no-store') resolve(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string,@Param('deliveryId')d:string,@Body()b:PartOrderMailResolutionDto){return this.mail.resolve(r.seller.id,c,t,w,o,d,b);}
 @Get() @Header('Cache-Control','no-store') list(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string){return this.service.list(r.seller.id,c,t,w);}
 @Post() create(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Body()b:CreatePartOrderDto){return this.service.create(r.seller.id,c,t,w,b);}
 @Post(':orderId/events') event(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string,@Body()b:PartOrderEventDto){return this.service.event(r.seller.id,c,t,w,o,b);}
 @Get(':orderId/pdf') @Header('Cache-Control','no-store') pdf(@Req()r:RequestWithSeller,@Param('id')c:string,@Param('ticketId')t:string,@Param('workId')w:string,@Param('orderId')o:string){return this.service.pdf(r.seller.id,c,t,w,o);}
}

