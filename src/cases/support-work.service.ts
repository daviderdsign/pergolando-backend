import {supportScope} from './support-quote.service.js';
import {Injectable,HttpStatus} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {DomainException} from '../common/domain-exception.js';
import {CreateSupportWorkDto,SupportWorkDto} from './support-work.dto.js';
import {supportWorkCosts} from './support-work-costs.js';
import {enqueueSupportNotification} from './support-notifications.service.js';
import {financeSummary} from './finance-summary.js';
const fail=(s:string)=>new DomainException('INTERVENTO_NON_VALIDO',s,HttpStatus.CONFLICT);
export const crewKey=(s:string)=>s.trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('it-IT');
@Injectable() export class SupportWorkService {
 constructor(private readonly db:PrismaService){}
 private async owned(seller:string,id:string,ticketId:string){const t=await this.db.supportTicket.findFirst({where:{id:ticketId,caseId:id,customerCase:{sellerId:seller}}});if(!t)throw fail('Richiesta non disponibile.');return t;}
 async list(seller:string,id:string,ticketId:string){await this.owned(seller,id,ticketId);return (await this.db.supportWork.findMany({where:{ticketId},include:{events:{orderBy:{revision:'asc'}}},orderBy:{createdAt:'asc'}})).map(w=>({...w,snapshot:JSON.parse(w.snapshot),events:w.events.map(e=>({...e,snapshot:JSON.parse(e.snapshot)}))}));}
 async finance(seller:string,id:string,ticketId:string,workId:string){await this.owned(seller,id,ticketId);return this.db.$transaction(async tx=>{const w=await tx.supportWork.findFirst({where:{id:workId,ticketId}});if(!w)throw fail('Intervento non disponibile.');const entries=await tx.caseFinanceEntry.findMany({where:{caseId:id},orderBy:{createdAt:'asc'}}),p=await tx.customerCase.findUniqueOrThrow({where:{id}}),active=new Set(financeSummary(entries,false,!!p.deliveredAt).activeIds);return {financeRevision:p.financeRevision,manual:entries.filter(e=>active.has(e.id)&&!e.sourceWorkId&&!e.sourceOrderKey&&['LABOR','SUPPLIER','OTHER'].includes(e.kind)),managed:entries.filter(e=>active.has(e.id)&&e.sourceWorkId===workId),history:entries.filter(e=>e.sourceWorkId===workId).map(e=>({...e,active:active.has(e.id)})),documents:await tx.caseFinanceDocument.findMany({where:{caseId:id},select:{id:true,name:true}})};});}
 async create(seller:string,id:string,ticketId:string,b:CreateSupportWorkDto){await this.owned(seller,id,ticketId);await this.db.$transaction(async tx=>{await tx.customerCase.update({where:{id},data:{updatedAt:new Date()}});if(await tx.supportWork.findUnique({where:{ticketId_requestKey:{ticketId,requestKey:b.requestKey}}}))return;await tx.supportWork.create({data:{ticketId,requestKey:b.requestKey,title:b.title.trim(),snapshot:JSON.stringify({coverage:'TO_ASSESS',crew:'',parts:[]})}});await tx.customerCase.update({where:{id},data:{financeRevision:{increment:1},costsComplete:false}});});return this.list(seller,id,ticketId);}
 async save(seller:string,id:string,ticketId:string,workId:string,b:SupportWorkDto){await this.owned(seller,id,ticketId);if(!b.reviewed)throw fail('Verifica i dati prima di salvare.');await this.db.$transaction(async tx=>{
  const project=await tx.customerCase.update({where:{id},data:{updatedAt:new Date()}});
  const w=await tx.supportWork.findFirst({where:{id:workId,ticketId}});if(!w)throw fail('Intervento non disponibile.');
  if(await tx.supportWorkEvent.findUnique({where:{workId_requestKey:{workId,requestKey:b.requestKey}}}))return;
  if(w.revision!==b.revision)throw fail('Intervento aggiornato: ricarica prima di modificare.');
  if(b.status==='COMPLETED'&&b.financeRevision!==undefined&&project.financeRevision!==b.financeRevision)throw fail('Il conto economico è cambiato: aggiorna i collegamenti dei costi e verificali prima di completare.');
  if(b.status!=='COMPLETED'&&[b.replacesLaborId,b.replacesPartsId,b.replacesOtherId].some(Boolean))throw fail('I collegamenti dei costi si applicano soltanto al completamento o alla rettifica del consuntivo.');
  if(w.status==='COMPLETED'&&b.status!=='COMPLETED')throw fail('I costi sostenuti non possono essere cancellati: correggi il consuntivo o crea un nuovo intervento.');
  if(b.coverage==='CHARGEABLE'&&['CONFIRMED','COMPLETED'].includes(b.status)&&!(w.status==='COMPLETED'&&b.status==='COMPLETED'&&supportScope(JSON.parse(w.snapshot))===supportScope(b))){const quote=await tx.supportQuote.findFirst({where:{workId,status:'ACCEPTED'},orderBy:{number:'desc'}});if(!quote||JSON.parse(quote.snapshot).scope!==supportScope(b))throw fail('Serve un preventivo accettato corrispondente alle attivita e ai ricambi attuali.');}
  if(supportScope(JSON.parse(w.snapshot))!==supportScope(b)&&await tx.caseFinanceEntry.count({where:{caseId:id,sourceSupportWorkId:workId}}))throw fail('Esistono registrazioni commerciali dell’assistenza: conserva la copertura e i ricambi storici, oppure apri un nuovo intervento.');
  const partOrders=await tx.supportPartOrder.findMany({where:{workId,status:{not:'CANCELLED'}}});if(partOrders.length&&b.status==='CANCELLED')throw fail('Riconcilia prima gli ordini ricambi attivi con il fornitore.');if(partOrders.length&&supportScope(JSON.parse(w.snapshot))!==supportScope(b))throw fail('Esistono ordini ricambi attivi: non modificare copertura o ricambi senza riconciliare gli ordini.');
  const start=b.startAt?new Date(b.startAt):null,end=start&&b.durationMinutes?new Date(+start+b.durationMinutes*60000):null;
  if(b.status==='CONFIRMED'){
   if(!start||!end||!/(Z|[+-]\d\d:\d\d)$/.test(b.startAt!)||!b.crew.trim()||!b.availabilityChecked||!b.customerAgreed||b.parts.some(p=>p.available<p.required))throw fail('Verifica data, squadra, accordo cliente e disponibilità di tutti i ricambi.');
   const others=await tx.supportWork.findMany({where:{id:{not:workId},status:'CONFIRMED',ticket:{customerCase:{sellerId:seller}}}});
   if(others.some(o=>{const s=JSON.parse(o.snapshot);return crewKey(s.crew)===crewKey(b.crew)&&new Date(s.startAt)<end&&new Date(s.endAt)>start;}))throw fail('Squadra già impegnata in un altro intervento.');
   const poses=await tx.caseInstallationEvent.findMany({where:{customerCase:{sellerId:seller}},orderBy:{revision:'desc'}}),seen=new Set<string>();
   for(const p of poses){if(seen.has(p.caseId))continue;seen.add(p.caseId);const s=JSON.parse(p.snapshot);if(s.status==='CONFIRMED'&&s.crewKey===crewKey(b.crew)&&new Date(s.startAt)<end&&new Date(s.endAt)>start)throw fail('Squadra già impegnata in una posa.');}
  }
  let labor=0,parts=0;
  if(b.status==='COMPLETED'){
   if(!b.crew.trim()||!b.occurredOn||!Number.isFinite(Date.parse(b.occurredOn)))throw fail('Completa squadra e data effettiva dei costi.');
   if(!['CONFIRMED','COMPLETED'].includes(w.status)||!b.financeReviewed||b.hours===undefined||b.hourlyRateCents===undefined||b.otherCostCents===undefined||!b.occurredOn||new Date(b.occurredOn).toISOString().slice(0,10)!==b.occurredOn)throw fail('Conferma prima l’intervento e completa data e costi effettivi, anche se pari a zero.');
   if(b.parts.some(p=>p.used===undefined||p.used>p.available||(p.used>0&&p.unitCostCents===undefined)))throw fail('Indica quantità usate, disponibilità e costo di ogni ricambio utilizzato.');
   labor=Math.round(b.hours*b.hourlyRateCents);parts=b.parts.reduce((n,p)=>n+p.used!*(p.unitCostCents??0),0);
   if(![labor,parts].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000))throw fail('Importi fuori intervallo.');
  }
  const snapshot=JSON.stringify({...b,endAt:end?.toISOString(),crew:b.crew.trim()});
  const event=await tx.supportWorkEvent.create({data:{workId,requestKey:b.requestKey,revision:b.revision+1,sellerId:seller,snapshot}});
  await tx.supportWork.update({where:{id:workId},data:{status:b.status,revision:{increment:1},snapshot}});
  if(b.status!=='COMPLETED')await tx.customerCase.update({where:{id},data:{financeRevision:{increment:1},costsComplete:false}});
  if(b.status==='COMPLETED')await supportWorkCosts(tx,{caseId:id,workId,eventId:event.id,title:w.title,crew:b.crew,occurredOn:b.occurredOn!,hours:b.hours!,hourlyRateCents:b.hourlyRateCents!,labor,parts,other:b.otherCostCents!,replacesLaborId:b.replacesLaborId,replacesPartsId:b.replacesPartsId,replacesOtherId:b.replacesOtherId});
  if(b.customerMessage.trim()){const t=await tx.supportTicket.update({where:{id:ticketId},data:{revision:{increment:1}}});await tx.supportTicketEvent.create({data:{ticketId,requestKey:`work-${event.id}`,revision:t.revision,actor:'SELLER',status:t.status,priority:t.priority,assignee:t.assignee,internalNote:'',message:b.customerMessage.trim()}});await enqueueSupportNotification(tx,{ticketId,revision:t.revision,kind:'CLIENT_UPDATE'});}
 });return this.list(seller,id,ticketId);}
}







