import {HttpStatus} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {DomainException} from '../common/domain-exception.js';
const fail=(s:string)=>new DomainException('COSTO_ORDINE_DA_VERIFICARE',s,HttpStatus.CONFLICT);
export async function recordOrderCost(tx:Prisma.TransactionClient,input:{caseId:string;batchId:string;groupIndex:number;eventId:string;kind:string;supplier:string;reference:string;date:string;amount:number;financeReviewed?:boolean;invoiceComplete?:boolean;supersedesFinanceId?:string;file:{id:string;name:string;hash:string}|null}){
 if(input.kind==='RECEIPT')return;
 if(input.financeReviewed!==true)throw fail('Verifica anche il collegamento al conto economico e le eventuali voci già registrate.');
 const key=`${input.batchId}/${input.groupIndex}`,entries=await tx.caseFinanceEntry.findMany({where:{caseId:input.caseId,sourceOrderKey:key}}),replaced=new Set(entries.map(e=>e.supersedesId)),active=entries.find(e=>!replaced.has(e.id));
 if(input.supersedesFinanceId&&active)throw fail('Questo ordine è già collegato al conto: le nuove registrazioni sostituiscono automaticamente la sua voce.');
 let previous=active;
 if(input.supersedesFinanceId){const old=await tx.caseFinanceEntry.findFirst({where:{id:input.supersedesFinanceId,caseId:input.caseId,kind:'SUPPLIER',sourceOrderKey:null,sourceWorkId:null}});if(!old||await tx.caseFinanceEntry.findFirst({where:{caseId:input.caseId,OR:[{supersedesId:old.id},{absorbsEntryId:old.id}]}}))throw fail('La voce manuale da sostituire non è disponibile o non è attiva.');previous=old;}
 // A later order confirmation must never replace an invoiced amount with a forecast.
 if(input.kind==='CONFIRMATION'&&previous?.stage==='ACTUAL'){if(input.supersedesFinanceId)throw fail('La voce selezionata è già effettiva: collegala registrando il totale fatturato, non una previsione.');return;}
 if(input.kind==='INVOICE'&&typeof input.invoiceComplete!=='boolean')throw fail('Indica se il totale fatturato è parziale o definitivo.');
 let documentId:string|null=null;
 if(input.file){const file=await tx.caseFile.findUniqueOrThrow({where:{id:input.file.id}});documentId=(await tx.caseFinanceDocument.upsert({where:{caseId_hash:{caseId:input.caseId,hash:file.hash}},create:{caseId:input.caseId,name:file.name,mimeType:file.mimeType,hash:file.hash,data:file.data},update:{}})).id;}
 await tx.caseFinanceEntry.create({data:{caseId:input.caseId,requestKey:`order-${input.eventId}`,kind:'SUPPLIER',stage:input.kind==='INVOICE'?'ACTUAL':'PLANNED',description:`${input.kind==='INVOICE'?'Totale fatturato cumulativo':'Conferma produttore'} ${input.reference}`.slice(0,250),supplier:input.supplier,amountCents:input.amount,occurredOn:input.date,supersedesId:previous?.id||null,documentId,sourceOrderKey:key,sourceOrderEventId:input.eventId,costPending:input.kind==='INVOICE'?!input.invoiceComplete:true}});
}


