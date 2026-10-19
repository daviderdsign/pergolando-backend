import {Injectable,HttpStatus} from '@nestjs/common';import {PrismaService} from '../prisma/prisma.service.js';import {DomainException} from '../common/domain-exception.js';
import {CreatePartOrderDto,PartOrderEventDto} from './support-part-order.dto.js';import {supportPartOrderPdf} from './support-part-order-pdf.js';import {supportScope} from './support-quote.service.js';
const fail=(s:string)=>new DomainException('ORDINE_RICAMBI',s,HttpStatus.CONFLICT);
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
@Injectable() export class SupportPartOrderService {
 constructor(private readonly db:PrismaService){}
 private async owned(seller:string,c:string,t:string,w:string){const work=await this.db.supportWork.findFirst({where:{id:w,ticketId:t,ticket:{caseId:c,customerCase:{sellerId:seller}}}});if(!work)throw fail('Intervento non disponibile.');return work;}
 async list(seller:string,c:string,t:string,w:string){await this.owned(seller,c,t,w);return (await this.db.supportPartOrder.findMany({where:{workId:w},include:{events:{orderBy:{revision:'asc'}}},orderBy:{number:'desc'}})).map(({pdf,...o})=>({...o,snapshot:JSON.parse(o.snapshot),events:o.events.map(e=>({...e,snapshot:JSON.parse(e.snapshot)}))}));}
 async create(seller:string,c:string,t:string,w:string,b:CreatePartOrderDto){await this.owned(seller,c,t,w);await this.db.$transaction(async tx=>{
  const p=await tx.customerCase.update({where:{id:c},data:{updatedAt:new Date()}}),work=await tx.supportWork.findUniqueOrThrow({where:{id:w}});
  if(await tx.supportPartOrder.findUnique({where:{workId_requestKey:{workId:w,requestKey:b.requestKey}}}))return;
  const old=await tx.supportPartOrder.findMany({where:{workId:w},orderBy:{number:'desc'}}),s=JSON.parse(work.snapshot);
  if(!b.reviewed||b.workRevision!==work.revision||(old[0]?.number||0)!==b.ordersRevision)throw fail('Dati cambiati: ricarica e verifica l’ordine.');
  if(['COMPLETED','CANCELLED'].includes(work.status)||!['CHARGEABLE','WARRANTY'].includes(s.coverage))throw fail('Valuta la copertura e usa un intervento ancora da eseguire.');
  if(s.coverage==='CHARGEABLE'){const q=await tx.supportQuote.findFirst({where:{workId:w,status:'ACCEPTED'},orderBy:{number:'desc'}});if(!q||JSON.parse(q.snapshot).scope!==supportScope(s))throw fail('Prima dell’acquisto serve il preventivo assistenza accettato per questi ricambi.');}
  if(!b.deliveryAddress.trim()||!b.note.trim()||!b.lines.length||new Set(b.lines.map(l=>l.partIndex)).size!==b.lines.length)throw fail('Completa recapito, indicazioni e ricambi senza duplicati.');
  const lines=b.lines.map(l=>{const part=s.parts?.[l.partIndex];if(!part||!part.supplier?.trim()||!Number.isInteger(l.quantity)||l.quantity<1)throw fail('Seleziona ricambi esistenti con fornitore e quantità esplicita.');const ordered=old.filter(o=>o.status!=='CANCELLED').reduce((n,o)=>n+(JSON.parse(o.snapshot).lines.find((x:any)=>x.partIndex===l.partIndex)?.quantity||0),0);if(ordered+l.quantity>part.required)throw fail(`La quantità di ${part.code} supera il fabbisogno già previsto, considerando gli altri ordini attivi.`);return {partIndex:l.partIndex,code:part.code,description:part.description,supplier:part.supplier.trim(),quantity:l.quantity};});
  if(lines.some(l=>l.supplier!==lines[0].supplier))throw fail('Prepara un ordine separato per ciascun fornitore.');
  const account=await tx.seller.findUniqueOrThrow({where:{id:seller}}),setup=await tx.dealerSetup.findUnique({where:{sellerId:seller}}),profile=setup?JSON.parse(setup.profile):{},snapshot={number:(old[0]?.number||0)+1,workId:w,title:work.title,caseName:p.caseName,dealer:profile.company?.trim()||account.email,supplier:lines[0].supplier,preparedOn:new Date().toISOString().slice(0,10),deliveryAddress:b.deliveryAddress.trim(),note:b.note.trim(),lines,scope:supportScope(s)};
  await tx.supportPartOrder.create({data:{workId:w,number:snapshot.number,requestKey:b.requestKey,supplier:snapshot.supplier,sellerId:seller,snapshot:JSON.stringify(snapshot),pdf:(await supportPartOrderPdf(snapshot)).toString('base64')}});
 });return this.list(seller,c,t,w);}
 async event(seller:string,c:string,t:string,w:string,id:string,b:PartOrderEventDto){await this.owned(seller,c,t,w);await this.db.$transaction(async tx=>{
  await tx.customerCase.update({where:{id:c},data:{updatedAt:new Date()}});const order=await tx.supportPartOrder.findFirst({where:{id,workId:w},include:{events:{orderBy:{revision:'desc'}}}});if(!order)throw fail('Ordine non disponibile.');if(order.events.some(e=>e.requestKey===b.requestKey))return;
  if(order.revision!==b.revision||!b.reviewed||!b.reference.trim()||!b.note.trim()||!validDate(b.occurredOn)||(b.expectedOn&&!validDate(b.expectedOn)))throw fail('Verifica revisione, date, riferimento e note.');
  const deliveries=await tx.supportPartOrderDelivery.findMany({where:{orderId:id}});if(deliveries.some(d=>d.status==='SENDING'||d.status==='UNKNOWN'&&!d.resolution))throw fail('Invio email in corso o esito incerto: verifica lo storico prima di modificare l’ordine.');
  if(order.status==='CANCELLED')throw fail('Ordine già annullato.');
  if(b.kind==='SENT'&&order.status!=='DRAFT')throw fail('Invio già registrato: non ripetere l’ordine.');
  if(['CONFIRMATION','RECEIPT','RETURN'].includes(b.kind)&&order.status!=='SENT')throw fail('Registra prima l’invio effettuato al fornitore.');
  const previous=order.events.find(e=>e.kind==='RECEIPT'),received=previous?JSON.parse(previous.snapshot).quantities:[],lines=JSON.parse(order.snapshot).lines;
  const returnedEvent=order.events.find(e=>e.kind==='RETURN'),returned=returnedEvent?JSON.parse(returnedEvent.snapshot).quantities:[];
  if(b.kind==='CANCELLED'&&received.some((q:any)=>q.received>(returned.find((r:any)=>r.partIndex===q.partIndex)?.received||0)))throw fail('Ci sono materiali ricevuti: prima occorre gestire reso o rettifica degli arrivi.');
  if(b.kind==='RETURN'){
   if(b.quantities.length!==lines.length||new Set(b.quantities.map(q=>q.partIndex)).size!==lines.length)throw fail('Indica i resi cumulativi di tutti i ricambi.');
   for(const q of b.quantities){const line=lines.find((l:any)=>l.partIndex===q.partIndex);if(!line||!Number.isInteger(q.received)||q.received<0||q.received>(received.find((r:any)=>r.partIndex===q.partIndex)?.received||0))throw fail('Resi superiori agli arrivi registrati.');if(q.received<(returned.find((r:any)=>r.partIndex===q.partIndex)?.received||0)&&!b.correction)throw fail('La diminuzione dei resi richiede una rettifica verificata.');}
  }else if(b.kind==='RECEIPT'){
   if(b.quantities.length!==lines.length||new Set(b.quantities.map(q=>q.partIndex)).size!==lines.length)throw fail('Indica l’arrivo cumulativo di tutti i ricambi dell’ordine.');
   for(const q of b.quantities){const line=lines.find((l:any)=>l.partIndex===q.partIndex);if(!line||!Number.isInteger(q.received)||q.received<0||q.received>line.quantity)throw fail('Quantità ricevute fuori dai limiti ordinati.');if(q.received<(returned.find((r:any)=>r.partIndex===q.partIndex)?.received||0))throw fail('Gli arrivi non possono scendere sotto i resi registrati.');if(q.received<(received.find((r:any)=>r.partIndex===q.partIndex)?.received||0)&&!b.correction)throw fail('Una diminuzione degli arrivi richiede la verifica esplicita della rettifica.');}
  }else if(b.quantities.length)throw fail('Le quantità ricevute si indicano solo per arrivi o resi.');
  await tx.supportPartOrderEvent.create({data:{orderId:id,requestKey:b.requestKey,revision:b.revision+1,kind:b.kind,sellerId:seller,snapshot:JSON.stringify(b)}});
  await tx.supportPartOrder.update({where:{id},data:{revision:{increment:1},status:b.kind==='SENT'?'SENT':b.kind==='CANCELLED'?'CANCELLED':order.status}});
 });return this.list(seller,c,t,w);}
 async pdf(seller:string,c:string,t:string,w:string,id:string){await this.owned(seller,c,t,w);const order=await this.db.supportPartOrder.findFirst({where:{id,workId:w}});if(!order)throw fail('Documento non disponibile.');return {name:`ordine-ricambi-${order.number}.pdf`,mimeType:'application/pdf',data:order.pdf};}
}


