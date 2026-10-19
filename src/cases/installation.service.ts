import {Injectable,HttpStatus} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {DomainException} from '../common/domain-exception.js';
import {InstallationDto} from './installation.dto.js';
const fail=(s:string)=>new DomainException('POSA_DA_VERIFICARE',s,HttpStatus.CONFLICT);
@Injectable() export class CaseInstallationService {
 constructor(private readonly db:PrismaService){}
 private async readiness(tx:any,seller:string,id:string,startAt?:string){
  const p=await tx.customerCase.findFirst({where:{id,sellerId:seller}});if(!p)throw fail('Pratica non disponibile.');
  const batches=await tx.caseOrderBatch.findMany({where:{caseId:id,proposalId:p.confirmedProposalId||'__none__'},include:{deliveries:{select:{groupIndex:true,status:true}},events:{orderBy:{revision:'asc'}}}});
  const reasons:string[]=[],groups:any[]=[];
  if(!p.confirmedProposalId)reasons.push('Manca la conferma tecnica dell’offerta.');
  for(const batch of batches){const s=JSON.parse(batch.snapshot);for(const [index,group] of s.groups.entries()){const events=batch.events.filter((e:any)=>e.groupIndex===index),confirmation=events.filter((e:any)=>e.kind==='CONFIRMATION').at(-1),receipt=events.filter((e:any)=>e.kind==='RECEIPT').at(-1),c=confirmation?JSON.parse(confirmation.snapshot):null,r=receipt?JSON.parse(receipt.snapshot):null;const received=!!r&&group.lines.every((l:any)=>r.quantities.some((q:any)=>q.itemId===l.itemId&&q.received===l.quantity)),sent=!!confirmation||batch.deliveries.some((d:any)=>d.groupIndex===index&&d.status==='SMTP_ACCEPTED');groups.push({supplier:group.supplier,sent,confirmed:!!confirmation,received,expectedOn:c?.expectedOn||null});}}
  if(!groups.length)reasons.push('Prepara prima gli ordini ai produttori.');
  if(groups.some(g=>!g.sent))reasons.push('Completa l’invio degli ordini o registra la conferma ricevuta dal produttore.');
  const confirmReasons=[...reasons];
  if(!p.siteAddress.trim())confirmReasons.push('Completa l’indirizzo del cantiere nella pratica.');
  for(const g of groups){if(!g.confirmed)confirmReasons.push(`${g.supplier}: manca la conferma del produttore.`);if(!g.received){if(!g.expectedOn)confirmReasons.push(`${g.supplier}: manca una data di consegna promessa.`);else if(startAt&&new Date(g.expectedOn+'T23:59:59.999Z')>=new Date(startAt))confirmReasons.push(`${g.supplier}: consegna promessa non precedente alla posa; verifica gli arrivi prima di confermare.`);}}
  return {project:{id:p.id,caseName:p.caseName,siteAddress:p.siteAddress,confirmedProposalId:p.confirmedProposalId},groups,reasons,confirmReasons};
 }
 async get(seller:string,id:string){return this.db.$transaction(async tx=>{const history=await tx.caseInstallationEvent.findMany({where:{caseId:id},orderBy:{revision:'asc'}}),latest=history.at(-1),snapshot=latest?JSON.parse(latest.snapshot):null,ready=await this.readiness(tx,seller,id,snapshot?.startAt);return {...ready,history,revision:latest?.revision||0,current:snapshot,effectiveConfirmed:snapshot?.status==='CONFIRMED'&&!ready.confirmReasons.length&&snapshot.checkedAddress===ready.project.siteAddress&&snapshot.checkedProposalId===ready.project.confirmedProposalId};});}
 async save(seller:string,id:string,input:InstallationDto){
  await this.db.$transaction(async tx=>{
   if(!await tx.customerCase.findFirst({where:{id,sellerId:seller}}))throw fail('Pratica non disponibile.');
   if(await tx.caseInstallationEvent.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:input.requestKey}}}))return;
   await tx.customerCase.update({where:{id},data:{updatedAt:new Date()}});
   const latest=await tx.caseInstallationEvent.findFirst({where:{caseId:id},orderBy:{revision:'desc'}});if((latest?.revision||0)!==input.revision)throw fail('La pianificazione è cambiata. Ricarica prima di salvare.');
   const start=new Date(input.startAt);if(!/([zZ]|[+-]\d{2}:\d{2})$/.test(input.startAt)||!Number.isFinite(start.getTime())||!Number.isInteger(input.durationMinutes)||input.durationMinutes<15||input.durationMinutes>10080)throw fail('Indica data, ora con fuso e durata valide.');
   if(!['PROVISIONAL','CONFIRMED','CANCELLED'].includes(input.status)||!input.crew.trim()||!input.note.trim()||!input.reviewed)throw fail('Completa squadra, nota e verifica.');
   const end=new Date(start.getTime()+input.durationMinutes*60000),crewKey=input.crew.trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('it-IT');
   const ready=await this.readiness(tx,seller,id,start.toISOString());
   if(input.status==='CANCELLED'){if(!latest)throw fail('Non esiste un appuntamento da annullare.');}
   else if(ready.reasons.length)throw fail(ready.reasons.join(' '));
   if(input.status==='CONFIRMED'){
    if(ready.confirmReasons.length)throw fail(ready.confirmReasons.join(' '));
    if(!input.crewAvailable||!input.siteReady||!input.deliveryReliable||!input.customerAgreed)throw fail('Verifica squadra, cantiere, affidabilità delle consegne e accordo con il cliente.');
    const works=await tx.supportWork.findMany({where:{status:'CONFIRMED',ticket:{customerCase:{sellerId:seller}}}});if(works.some(w=>{const s=JSON.parse(w.snapshot);return s.crew.trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('it-IT')===crewKey&&new Date(s.startAt)<end&&new Date(s.endAt)>start;}))throw fail('La squadra ha un intervento di assistenza confermato in questo intervallo.');
    const all=await tx.caseInstallationEvent.findMany({where:{customerCase:{sellerId:seller},caseId:{not:id}},orderBy:{revision:'asc'}}),last=new Map<string,any>();for(const e of all)last.set(e.caseId,JSON.parse(e.snapshot));
    if([...last.values()].some(s=>s.status==='CONFIRMED'&&s.crewKey===crewKey&&new Date(s.startAt)<end&&new Date(s.endAt)>start))throw fail('La stessa squadra ha già una posa confermata in questo intervallo.');
   }
   await tx.caseInstallationEvent.create({data:{caseId:id,revision:input.revision+1,requestKey:input.requestKey,sellerId:seller,snapshot:JSON.stringify({...input,crew:input.crew.trim(),crewKey,startAt:start.toISOString(),endAt:end.toISOString(),note:input.note.trim(),checkedGroups:ready.groups,checkedAddress:ready.project.siteAddress,checkedProposalId:ready.project.confirmedProposalId,reviewedBy:seller})}});
  });return this.get(seller,id);
 }
}

