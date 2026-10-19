import {createTransport} from 'nodemailer';
const configured=!!process.env.SMTP_HOST&&!!process.env.SMTP_FROM;
console.log('SMTP configured:',configured);
if(!configured)process.exit(1);
const transport=createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT??587),secure:process.env.SMTP_SECURE==='true',connectionTimeout:10000,socketTimeout:15000,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});
try{await transport.verify();console.log('PASS: SMTP connection and authentication verified; no email sent');}catch(e){console.log('SMTP verification failed:',e.code,e.responseCode);process.exitCode=1;}finally{transport.close();}
