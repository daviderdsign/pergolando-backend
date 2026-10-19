import {Injectable,HttpStatus} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {DomainException} from '../common/domain-exception.js';
import {HANDOVER_CHECKS,HandoverDto} from './handover.dto.js';
import {handoverPdf} from './handover-pdf.js';
const fail=(s:string)=>new DomainException('VERBALE_DA_VERIFICARE',s,HttpStatus.CONFLICT);
const outcomes={COMPLETED:'Consegnato senza riserve',RESERVATIONS:'Consegnato con riserve',NOT_COMPLETED:'Lavori non completati / consegna non confermata'};
@Injectable() export class CaseHandoverService {
 constructor(private readonly db:PrismaService){}
 private async owned(seller:string,id:string){const p=await this.db.customerCase.findFirst({where:{id,sellerId:seller}});if(!p)throw fail('Pratica non disponibile.');return p;}
 async get(seller:string,id:string){const p=await this.owned(seller,id);return {project:{caseName:p.caseName,deliveredAt:p.deliveredAt},checks:HANDOVER_CHECKS,history:await this.db.caseHandover.findMany({where:{caseId:id},select:{id:true,revision:true,snapshot:true,createdAt:true,sellerId:true},orderBy:{revision:'desc'}}),files:await this.db.caseFile.findMany({where:{caseId:id},select:{id:true,name:true,mimeType:true},orderBy:{createdAt:'asc'}})};}
 async save(seller:string,id:string,b:HandoverDto){
  await this.owned(seller,id);
  await this.db.$transaction(async tx=>{
   if(await tx.caseHandover.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:b.requestKey}}}))return;
   const p=await tx.customerCase.update({where:{id},data:{updatedAt:new Date()}}),latest=await tx.caseHandover.findFirst({where:{caseId:id},orderBy:{revision:'desc'}});
   if((latest?.revision||0)!==b.revision)throw fail('Il verbale è cambiato. Ricarica prima di salvare.');
   if(!b.reviewed||!b.technician.trim()||!b.note.trim()||!outcomes[b.outcome as keyof typeof outcomes])throw fail('Completa tecnico, note, esito e verifica.');
   const date=new Date(b.occurredOn+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==b.occurredOn)throw fail('Data intervento non valida.');
   const ids=new Set(b.checks.map(c=>c.id));if(ids.size!==Object.keys(HANDOVER_CHECKS).length||ids.size!==b.checks.length||b.checks.some(c=>!HANDOVER_CHECKS[c.id as keyof typeof HANDOVER_CHECKS]||!['OK','ISSUE','NA'].includes(c.result)||c.result!=='OK'&&!c.note.trim()))throw fail('Compila tutti i controlli; spiega anomalie e voci non applicabili.');
   if(b.outcome==='COMPLETED'&&(b.checks.some(c=>c.result==='ISSUE')||b.reservations.trim()))throw fail('Le anomalie o riserve richiedono un esito con riserve o lavori non completati.');
   if(b.outcome!=='COMPLETED'&&!b.reservations.trim())throw fail('Descrivi le riserve, le attività residue e il seguito previsto.');
   const plan=await tx.caseInstallationEvent.findFirst({where:{caseId:id},orderBy:{revision:'desc'}}),ps=plan?JSON.parse(plan.snapshot):null;
   if(!ps||ps.status==='CANCELLED')throw fail('Registra prima la pianificazione della posa.');
   if(b.outcome!=='NOT_COMPLETED'&&(ps.status!=='CONFIRMED'||ps.checkedAddress!==p.siteAddress||ps.checkedProposalId!==p.confirmedProposalId))throw fail('Conferma o aggiorna prima la pianificazione del cantiere.');
   const proposal=p.confirmedProposalId?await tx.caseProposal.findFirst({where:{id:p.confirmedProposalId,caseId:id}}):null;if(!proposal)throw fail('Manca l’offerta confermata della pratica.');
   if(b.outcome==='COMPLETED'){const batches=await tx.caseOrderBatch.findMany({where:{caseId:id,proposalId:proposal.id},include:{events:{orderBy:{revision:'asc'}}}});if(!batches.length)throw fail('Mancano gli ordini della proposta.');for(const batch of batches){for(const [index,group] of JSON.parse(batch.snapshot).groups.entries()){const last=batch.events.filter(e=>e.groupIndex===index&&e.kind==='RECEIPT').at(-1),r=last?JSON.parse(last.snapshot):null;if(!r||!group.lines.every((l:any)=>r.quantities.some((q:any)=>q.itemId===l.itemId&&q.received===l.quantity)))throw fail('Registra tutti gli arrivi, oppure esplicita le riserve nel verbale.');}}}
   if(new Set(b.fileIds).size!==b.fileIds.length||b.fileIds.length>8)throw fail('Seleziona al massimo otto allegati distinti.');
   const files=await tx.caseFile.findMany({where:{caseId:id,id:{in:b.fileIds}}});if(files.length!==b.fileIds.length||files.reduce((n,f)=>n+f.size,0)>20*1024*1024)throw fail('Allegati non disponibili nella pratica o superiori a 20 MB complessivi.');
   const offer=JSON.parse(proposal.snapshot),snapshot={number:b.revision+1,caseName:p.caseName,client:[p.companyName,p.firstName,p.lastName].filter(Boolean).join(' '),siteAddress:p.siteAddress,proposalId:proposal.id,installationEventId:plan!.id,dealer:offer.documentStyle?.profile?{company:offer.documentStyle.profile.company}:null,products:(offer.items||[]).filter((i:any)=>!i.archivedAt).map((i:any)=>({brand:i.brand,productName:i.productName})),occurredOn:b.occurredOn,technician:b.technician.trim(),receiver:b.receiver.trim(),outcome:b.outcome,outcomeLabel:outcomes[b.outcome as keyof typeof outcomes],checks:b.checks.map(c=>({...c,label:HANDOVER_CHECKS[c.id as keyof typeof HANDOVER_CHECKS],note:c.note.trim()})),note:b.note.trim(),reservations:b.reservations.trim(),files:files.map(f=>({id:f.id,name:f.name,hash:f.hash,mimeType:f.mimeType})),reviewedBy:seller};
   let pdf:Buffer;try{pdf=await handoverPdf(snapshot,files);}catch{throw fail('PDF non generabile: verifica caratteri e immagini degli allegati.');}
   await tx.caseHandover.create({data:{caseId:id,requestKey:b.requestKey,revision:b.revision+1,sellerId:seller,snapshot:JSON.stringify(snapshot),pdf:pdf.toString('base64'),files:{create:files.map(f=>({fileId:f.id}))}}});
   await tx.customerCase.update({where:{id},data:{deliveredAt:b.outcome==='NOT_COMPLETED'?null:p.deliveredAt||new Date(),financeRevision:{increment:1},updatedAt:new Date()}});
  },{timeout:30000});return this.get(seller,id);
 }
 async document(seller:string,id:string,eventId:string){await this.owned(seller,id);const e=await this.db.caseHandover.findFirst({where:{id:eventId,caseId:id}});if(!e)throw fail('Verbale non disponibile.');return Buffer.from(e.pdf,'base64');}
}
