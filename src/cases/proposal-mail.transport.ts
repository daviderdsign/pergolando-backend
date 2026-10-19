import {Injectable,ServiceUnavailableException} from '@nestjs/common';import {createTransport} from 'nodemailer';
const fail=(message:string)=>new ServiceUnavailableException(message);
@Injectable()export class ProposalMailTransport{
 status(){const url=new URL(process.env.PUBLIC_APP_URL||'https://pergolando.rdsign-app.it');if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw fail('PUBLIC_APP_URL deve essere un indirizzo HTTPS pubblico.');return {from:process.env.SMTP_FROM||'',configured:!!process.env.SMTP_HOST&&!!process.env.SMTP_FROM,publicAppUrl:url.origin};}
 send(to:string,subject:string,text:string,pdf:Buffer,filename:string){const transport=createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});return transport.sendMail({from:process.env.SMTP_FROM,to,subject,text,attachments:[{filename,content:pdf,contentType:'application/pdf'}]});}
 sendNotice(to:string,subject:string,text:string){return createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000}).sendMail({from:process.env.SMTP_FROM,to,subject,text});}
}

