import {Injectable,HttpStatus} from '@nestjs/common';import {createHash} from 'node:crypto';import type {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service.js';import {DomainException} from '../common/domain-exception.js';
import {SupportQuoteDto,SupportQuoteDecisionDto} from './support-quote.dto.js';import {supportQuotePdf} from './support-quote-pdf.js';import {enqueueSupportNotification} from './support-notifications.service.js';
const fail=(s:string)=>new DomainException('PREVENTIVO_ASSISTENZA',s,HttpStatus.CONFLICT);
export function supportScope(s:any){return JSON.stringify({coverage:s.coverage,parts:(s.parts||[]).map((p:any)=>({code:p.code,description:p.description,required:p.required,supplier:p.supplier}))});}
@Injectable() export class SupportQuoteService {
 constructor(private readonly db:PrismaService){}
 private async owned(seller:string,caseId:string,ticketId:string,workId:string){const w=await this.db.supportWork.findFirst({where:{id:workId,ticketId,ticket:{caseId,customerCase:{sellerId:seller}}},include:{ticket:{include:{customerCase:true}}}});if(!w)throw fail('Intervento non disponibile.');return w;}
 private async access(db:Prisma.TransactionClient,token:string){if(!/^[-\w]{43}$/.test(token||''))throw fail('Collegamento non valido.');const a=await db.supportAccess.findUnique({where:{tokenHash:createHash('sha256').update(token).digest('hex')},include:{customerCase:true}});if(!a||a.revokedAt||a.expiresAt<=new Date()||!a.customerCase.deliveredAt||a.email!==a.customerCase.email.trim().toLowerCase())throw fail('Accesso scaduto o revocato.');return a;}
 private async rows(workId:string,publicView=false){const rows=await this.db.supportQuote.findMany({where:{workId},orderBy:{number:'desc'}});return rows.map(q=>({id:q.id,workId:q.workId,number:q.number,status:q.status,createdAt:q.createdAt,decidedAt:q.decidedAt,decisionActor:q.decisionActor,...(!publicView?{decisionNote:q.decisionNote}:{}),snapshot:(()=>{const {scope,...s}=JSON.parse(q.snapshot);return s;})(),expired:Date.now()>Date.parse(JSON.parse(q.snapshot).validUntil+'T23:59:59.999Z')}));}
 async list(seller:string,c:string,t:string,w:string){await this.owned(seller,c,t,w);return this.rows(w);}
 private async message(tx:Prisma.TransactionClient,ticketId:string,text:string,customer=false){const t=await tx.supportTicket.update({where:{id:ticketId},data:{revision:{increment:1}}});await tx.supportTicketEvent.create({data:{ticketId,requestKey:crypto.randomUUID(),revision:t.revision,actor:customer?'CUSTOMER':'SELLER',status:t.status,priority:t.priority,assignee:t.assignee,internalNote:'',message:text}});await enqueueSupportNotification(tx,{ticketId,revision:t.revision,kind:customer?'CUSTOMER_REPLY':'CLIENT_UPDATE'});}
 async issue(seller:string,c:string,t:string,w:string,b:SupportQuoteDto){await this.owned(seller,c,t,w);await this.db.$transaction(async tx=>{
  const p=await tx.customerCase.update({where:{id:c},data:{updatedAt:new Date()}}),work=await tx.supportWork.findUniqueOrThrow({where:{id:w}});
  if(await tx.supportQuote.findUnique({where:{workId_requestKey:{workId:w,requestKey:b.requestKey}}}))return;
  if(work.revision!==b.workRevision||work.status!=='PLANNED'||JSON.parse(work.snapshot).coverage!=='CHARGEABLE')throw fail('Imposta un intervento a pagamento da organizzare, quindi ricarica i dati.');
  if(!b.reviewed||!Number.isFinite(Date.parse(b.validUntil))||new Date(b.validUntil).toISOString().slice(0,10)!==b.validUntil||Date.parse(b.validUntil+'T23:59:59.999Z')<Date.now()||!b.terms.trim())throw fail('Verifica condizioni e validità del preventivo.');
  const current=await tx.supportQuote.findFirst({where:{workId:w},orderBy:{number:'desc'}});if((current?.number||0)!==b.quoteRevision)throw fail('Esiste una versione piu recente: ricarica prima di emettere.');
  const lines=b.lines.map(l=>{const netCents=Math.round(l.quantity*l.unitPriceCents),vatCents=Math.round(netCents*l.vatBps/10000);return {...l,netCents,vatCents,grossCents:netCents+vatCents};}),netCents=lines.reduce((n,l)=>n+l.netCents,0),vatCents=lines.reduce((n,l)=>n+l.vatCents,0);
  if(!lines.length||![netCents,vatCents,netCents+vatCents].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000))throw fail('Importi fuori intervallo.');
  const latest=await tx.supportQuote.findFirst({where:{workId:w},orderBy:{number:'desc'}}),dealer=await tx.seller.findUniqueOrThrow({where:{id:seller}}),s={number:(latest?.number||0)+1,title:work.title,caseName:p.caseName,client:[p.companyName,p.firstName,p.lastName].filter(Boolean).join(' '),email:p.email,dealer:dealer.email,issuedOn:new Date().toISOString().slice(0,10),validUntil:b.validUntil,terms:b.terms.trim(),lines,netCents,vatCents,grossCents:netCents+vatCents,scope:supportScope(JSON.parse(work.snapshot))};
  const setup=await tx.dealerSetup.findUnique({where:{sellerId:seller}});if(setup){const profile=JSON.parse(setup.profile);if(typeof profile.company==='string'&&profile.company.trim())s.dealer=profile.company.trim();}
  const pdf=(await supportQuotePdf(s)).toString('base64');await tx.supportQuote.updateMany({where:{workId:w,status:{in:['ISSUED','ACCEPTED']}},data:{status:'SUPERSEDED'}});await tx.supportQuote.create({data:{workId:w,number:s.number,requestKey:b.requestKey,sellerId:seller,snapshot:JSON.stringify(s),pdf}});await this.message(tx,t,`Disponibile il preventivo assistenza n. ${s.number} per ${work.title}.`);
 });return this.list(seller,c,t,w);}
 async publicList(token:string,ticketId:string){const a=await this.access(this.db,token),works=await this.db.supportWork.findMany({where:{ticketId,ticket:{caseId:a.caseId}}});return (await Promise.all(works.map(w=>this.rows(w.id,true)))).flat();}
 async decide(seller:string|null,c:string|null,t:string,qid:string,b:SupportQuoteDecisionDto,token?:string){await this.db.$transaction(async tx=>{
  let caseId=c;if(!seller){const a=await this.access(tx,token||'');caseId=a.caseId;}
  await tx.customerCase.update({where:{id:caseId!},data:{updatedAt:new Date()}});if(!seller)await this.access(tx,token||'');
  const q=await tx.supportQuote.findFirst({where:{id:qid,work:{ticketId:t,ticket:{caseId:caseId!,...(seller?{customerCase:{sellerId:seller}}:{})}}},include:{work:true}});if(!q)throw fail('Preventivo non disponibile.');
  if(q.decisionKey===b.requestKey)return;
  if(!b.reviewed||q.status!=='ISSUED'||(!seller&&b.decision==='WITHDRAWN')||(seller&&!b.note.trim()))throw fail('Verifica il preventivo e indica il riferimento alla decisione del cliente.');
  if(b.decision==='ACCEPTED'&&q.work.status!=='PLANNED')throw fail('Intervento non piu disponibile per accettazione.');
  const s=JSON.parse(q.snapshot);if(b.decision!=='WITHDRAWN'&&Date.now()>Date.parse(s.validUntil+'T23:59:59.999Z'))throw fail('Preventivo scaduto: richiedi una nuova versione.');
  if(s.scope!==supportScope(JSON.parse(q.work.snapshot)))throw fail('L’intervento è cambiato: occorre un nuovo preventivo.');
  await tx.supportQuote.update({where:{id:qid},data:{status:b.decision,decisionKey:b.requestKey,decisionActor:seller?'DEALER_RECORDED':'CUSTOMER_LINK',decisionNote:b.note,decidedAt:new Date()}});await this.message(tx,t,`Preventivo assistenza n. ${q.number}: ${{ACCEPTED:'accettato',REJECTED:'rifiutato',WITHDRAWN:'ritirato'}[b.decision]}.`,!seller);
 });return {saved:true};}
 async pdf(seller:string|null,c:string|null,t:string,qid:string,token?:string){const a=seller?null:await this.access(this.db,token||''),q=await this.db.supportQuote.findFirst({where:{id:qid,work:{ticketId:t,ticket:{caseId:(c||a?.caseId)!,...(seller?{customerCase:{sellerId:seller}}:{})}}}});if(!q)throw fail('Documento non disponibile.');return {name:`preventivo-assistenza-${q.number}.pdf`,data:q.pdf,mimeType:'application/pdf'};}
}


