import {Body,Controller,Get,Post,Module,UseGuards,ServiceUnavailableException,BadRequestException} from '@nestjs/common';
import {IsEmail,IsString,MaxLength} from 'class-validator';
import {createTransport} from 'nodemailer';
import {AuthModule} from '../auth/auth.module.js';
import {SessionAuthGuard} from '../auth/guards/session-auth.guard.js';
class SendQuoteDto{
 @IsEmail() to!:string;
 @IsString() @MaxLength(120) customer!:string;
 @IsString() @MaxLength(120) product!:string;
 @IsString() @MaxLength(12000000) pdfBase64!:string;
}
function transporter(){return createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT??587),secure:process.env.SMTP_SECURE==='true',connectionTimeout:10000,socketTimeout:15000,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});}
@Controller('quote-document')
@UseGuards(SessionAuthGuard)
class QuoteDocumentController{
 @Get('mail-status') status(){return {configured:!!process.env.SMTP_HOST&&!!process.env.SMTP_FROM};}
 @Post('verify-mail') async verify(){if(!this.status().configured)return {configured:false,verified:false,message:'Configurare SMTP_HOST e SMTP_FROM e le credenziali della casella.'};try{await transporter().verify();return {configured:true,verified:true,message:'Collegamento SMTP verificato. Nessuna email inviata.'};}catch{return {configured:true,verified:false,message:'Connessione SMTP non riuscita: controllare la configurazione della casella.'};}}
 @Post('send') async send(@Body() body:SendQuoteDto){if(!this.status().configured)throw new ServiceUnavailableException('Invio email non configurato. Puoi scaricare il PDF.');const pdf=Buffer.from(body.pdfBase64,'base64');if(pdf.subarray(0,5).toString()!=='%PDF-')throw new BadRequestException('Documento PDF non valido.');try{const result=await transporter().sendMail({from:process.env.SMTP_FROM,to:body.to,subject:`Il tuo preventivo Â· ${body.product}`,text:`Gentile ${body.customer},\n\nin allegato trovi il preventivo del tuo progetto ${body.product}.\n\nGrazie per il tuo interessamento.`,attachments:[{filename:'Preventivo.pdf',content:pdf,contentType:'application/pdf'}]});if(!result.accepted?.length)throw new Error('Recipient rejected');return {sent:true};}catch{throw new ServiceUnavailableException('Invio non riuscito. Il PDF resta disponibile per il download.');}}
}
@Module({imports:[AuthModule],controllers:[QuoteDocumentController]})
export class QuoteDocumentModule{}
