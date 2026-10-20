import {Injectable,OnModuleInit,OnModuleDestroy} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service.js';
import {ProposalMailTransport} from './proposal-mail.transport.js';
@Injectable()export class CaseNotificationsService implements OnModuleInit,OnModuleDestroy{
 private timer?:ReturnType<typeof setInterval>;
 private running=false;
 constructor(private readonly db:PrismaService,private readonly mail:ProposalMailTransport){}
 async onModuleInit(){await this.db.caseNotification.updateMany({where:{status:'SENDING'},data:{status:'UNKNOWN',errorCode:'PROCESS_INTERRUPTED'}});this.timer=setInterval(()=>void this.flush().catch(()=>{}),30000);}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async enqueue(tx:Prisma.TransactionClient,input:{caseId:string;invitationId:string;kind:string;sellerId:string;clientEmail:string;customer:string;number:number;note?:string}){
  const owner=input.kind==='CLIENT_ACCEPTED';const recipient=owner?(await tx.seller.findUnique({where:{id:input.sellerId},select:{email:true}}))?.email||'':input.clientEmail;
  const action=owner?'Il cliente ha accettato il preventivo':input.kind==='CLIENT_ACCEPTANCE_RECEIPT'?'La tua accettazione del preventivo è stata registrata':input.kind==='SELLER_CONFIRMED'?'Il rivenditore ha confermato la proposta':'Il rivenditore richiede di riaprire la trattativa';
  const subject=`Pergolando · ${action} · revisione ${input.number}`;
  const text=`${action}.\nCliente: ${input.customer}\nRevisione: ${input.number}\n${input.note?`Nota del rivenditore: ${input.note}\n`:''}\n${owner?'Accedi a Pergolando e apri la pratica per la verifica tecnica.':input.kind==='CLIENT_ACCEPTANCE_RECEIPT'?'Il rivenditore deve ancora completare la verifica tecnica. Acconti e saldi saranno concordati direttamente con il rivenditore.':'Acconti, saldi e prossimi passaggi saranno concordati direttamente con il rivenditore.'}`;
  await tx.caseNotification.upsert({where:{invitationId_kind:{invitationId:input.invitationId,kind:input.kind}},create:{caseId:input.caseId,invitationId:input.invitationId,kind:input.kind,recipient,subject,text,...(!recipient?{status:'FAILED',errorCode:'MISSING_RECIPIENT'}:{})},update:{}});
 }
 async flush(){if(this.running)return;this.running=true;try{if(!this.mail.status().configured)return;const pending=await this.db.caseNotification.findMany({where:{status:'PENDING'},orderBy:{createdAt:'asc'},take:10});for(const row of pending){const claimed=await this.db.caseNotification.updateMany({where:{id:row.id,status:'PENDING'},data:{status:'SENDING',attempts:{increment:1}}});if(!claimed.count)continue;let status='UNKNOWN',errorCode:string|null=null;try{const result=await this.mail.sendNotice(row.recipient,row.subject,row.text);status=result.accepted?.some(x=>String(x).toLowerCase()===row.recipient.toLowerCase())?'SMTP_ACCEPTED':'FAILED';if(status==='FAILED')errorCode='RECIPIENT_REJECTED';}catch(error){const code=(error as {code?:string}).code||'';status=['EAUTH','EENVELOPE','ECONNREFUSED','EDNS'].includes(code)?'FAILED':'UNKNOWN';errorCode=/^[A-Z0-9_]{1,40}$/.test(code)?code:'TRANSPORT_ERROR';}await this.db.caseNotification.update({where:{id:row.id},data:{status,errorCode,completedAt:new Date()}});}}finally{this.running=false;}}
}

