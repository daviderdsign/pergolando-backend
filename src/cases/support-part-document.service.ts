import {HttpStatus,Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {DomainException} from '../common/domain-exception.js';
import {PartDocumentDto} from './support-part-document.dto.js';
const fail=(s:string)=>new DomainException('DOCUMENTO_RICAMBI',s,HttpStatus.CONFLICT);
@Injectable() export class SupportPartDocumentService {
 constructor(private readonly db:PrismaService){}
 private async owned(s:string,c:string,t:string,w:string,o:string){if(!await this.db.supportPartOrder.findFirst({where:{id:o,workId:w,work:{ticketId:t,ticket:{caseId:c,customerCase:{sellerId:s}}}}}))throw fail('Ordine non disponibile.');}
 async list(s:string,c:string,t:string,w:string,o:string){await this.owned(s,c,t,w,o);const [project,documents,costs,records]=await Promise.all([this.db.customerCase.findUniqueOrThrow({where:{id:c}}),this.db.caseFinanceDocument.findMany({where:{caseId:c},select:{id:true,name:true}}),this.db.caseFinanceEntry.findMany({where:{caseId:c}}),this.db.supportPartDocument.findMany({where:{caseId:c},orderBy:{createdAt:'asc'}})]);const replaced=new Set(costs.flatMap(e=>[e.supersedesId,e.absorbsEntryId])),old=new Set(records.map(e=>e.supersedesId));return {costHistory:costs.filter(e=>e.sourceWorkId===w&&e.kind==='SUPPLIER'&&e.stage==='ACTUAL'),financeRevision:project.financeRevision,documents,costs:costs.filter(e=>e.sourceWorkId===w&&e.kind==='SUPPLIER'&&e.stage==='ACTUAL'&&!replaced.has(e.id)),records:records.filter(e=>e.orderId===o).map(e=>({...e,active:!old.has(e.id),stale:!!e.costId&&replaced.has(e.costId)}))};}
 async save(s:string,c:string,t:string,w:string,o:string,b:PartDocumentDto){await this.owned(s,c,t,w,o);await this.db.$transaction(async tx=>{
  await tx.customerCase.update({where:{id:c},data:{updatedAt:new Date()}});
  if(await tx.supportPartDocument.findUnique({where:{orderId_requestKey:{orderId:o,requestKey:b.requestKey}}}))return;
  const project=await tx.customerCase.findUniqueOrThrow({where:{id:c}});if(project.financeRevision!==b.financeRevision)throw fail('Il conto è cambiato: ricarica prima di verificare.');
  const date=new Date(b.occurredOn+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==b.occurredOn||!b.reviewed)throw fail('Verifica data e documento.');
  const document=await tx.caseFinanceDocument.findFirst({where:{id:b.documentId,caseId:c}});if(!document)throw fail('Originale non appartenente alla pratica.');
  const all=await tx.supportPartDocument.findMany({where:{caseId:c}}),replaced=new Set(all.map(e=>e.supersedesId)),active=all.filter(e=>!replaced.has(e.id)&&e.id!==b.supersedesId);
  if(b.supersedesId&&!all.some(e=>e.id===b.supersedesId&&e.orderId===o&&!replaced.has(e.id)))throw fail('La registrazione da rettificare non è più attiva.');
  if(b.supersedesId&&all.find(e=>e.id===b.supersedesId)?.kind!==b.kind)throw fail('La rettifica deve mantenere il tipo del documento originale.');
  if(active.some(e=>e.orderId===o&&e.documentId===b.documentId))throw fail('Originale già registrato su questo ordine: usa la rettifica.');
  if(active.some(e=>e.documentId===b.documentId&&(e.netCents!==b.netCents||e.reference!==b.reference||e.kind!==b.kind||e.occurredOn!==b.occurredOn)))throw fail('I dati dello stesso originale devono coincidere tra gli ordini.');
  if(b.allocatedCents>0&&(!b.costId||!['INVOICE','CREDIT'].includes(b.kind)))throw fail('Collega la quota di fattura a un costo ricambi consuntivato.');
  if(b.costId&&b.allocatedCents===0)throw fail('Indica la quota netta verificata oppure archivia senza collegamento.');
  if(active.filter(e=>e.documentId===b.documentId).reduce((n,e)=>n+e.allocatedCents,0)+b.allocatedCents>b.netCents)throw fail('Le quote superano il netto del documento.');
  if(b.kind!=='CREDIT'&&(b.invoiceId||b.basisCostId))throw fail('Collegamenti nota di credito non pertinenti.');
  if(b.supersedesId&&active.some(e=>e.invoiceId===b.supersedesId&&e.allocatedCents>0))throw fail('Prima rettifica le note di credito collegate a questa fattura.');
  if(b.costId){const cost=await tx.caseFinanceEntry.findFirst({where:{id:b.costId,caseId:c,sourceWorkId:w,kind:'SUPPLIER',stage:'ACTUAL'}});if(!cost||await tx.caseFinanceEntry.findFirst({where:{caseId:c,OR:[{supersedesId:cost.id},{absorbsEntryId:cost.id}]}}))throw fail('Scegli un costo ricambi attivo di questo intervento.');if(b.kind!=='CREDIT'&&active.filter(e=>e.kind!=='CREDIT'&&e.costId===b.costId).reduce((n,e)=>n+e.allocatedCents,0)+b.allocatedCents>cost.amountCents)throw fail('Le quote superano il costo ricambi: correggi prima il consuntivo, se necessario.');}
  if(b.kind==='CREDIT'){
   const invoice=all.find(e=>e.id===b.invoiceId&&e.orderId===o&&e.kind==='INVOICE'&&!replaced.has(e.id));
   if(!invoice)throw fail('Seleziona la fattura attiva di questo ordine.');
   if(active.filter(e=>e.kind==='CREDIT'&&e.invoiceId===invoice.id).reduce((n,e)=>n+e.allocatedCents,0)+b.allocatedCents>invoice.netCents)throw fail('Le note superano il netto della fattura.');
   if(b.allocatedCents>0){
    const entries=await tx.caseFinanceEntry.findMany({where:{caseId:c,sourceWorkId:w,kind:'SUPPLIER',stage:'ACTUAL'}}),basis=entries.find(e=>e.id===b.basisCostId),cost=entries.find(e=>e.id===b.costId);
    let ancestor=cost;const seen=new Set<string>();while(ancestor&&ancestor.id!==basis?.id&&!seen.has(ancestor.id)){seen.add(ancestor.id);ancestor=entries.find(e=>e.id===ancestor!.supersedesId);}
    if(!basis||!cost||basis.id===cost.id||ancestor?.id!==basis.id)throw fail('Seleziona il costo precedente e la sua rettifica attiva nello stesso intervento.');
    if(active.some(e=>e.kind==='CREDIT'&&e.allocatedCents>0&&entries.some(x=>x.id===e.costId)&&e.basisCostId!==basis.id))throw fail('Usa lo stesso costo di partenza per le note di credito di questo intervento, oppure rettifica prima i collegamenti precedenti.');
    const credits=active.filter(e=>e.kind==='CREDIT'&&e.basisCostId===basis.id).reduce((n,e)=>n+e.allocatedCents,0);
    if(credits+b.allocatedCents>basis.amountCents-cost.amountCents)throw fail('La quota supera la riduzione già registrata nel consuntivo. Correggi prima il costo, senza duplicare lo storno.');
   }else if(b.basisCostId)throw fail('Per il solo archivio elimina il costo precedente.');
  }
  await tx.supportPartDocument.create({data:{invoiceId:b.invoiceId||null,basisCostId:b.basisCostId||null,orderId:o,caseId:c,requestKey:b.requestKey,documentId:b.documentId,kind:b.kind,reference:b.reference.trim(),occurredOn:b.occurredOn,netCents:b.netCents,allocatedCents:b.allocatedCents,costId:b.costId||null,supersedesId:b.supersedesId||null,note:b.note.trim(),sellerId:s}});
  await tx.customerCase.update({where:{id:c},data:{financeRevision:{increment:1},costsComplete:false}});
 });return this.list(s,c,t,w,o);}
}



