import {HttpStatus,Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {DomainException} from '../common/domain-exception.js';
import {PrepareOrdersDto,OrderPreviewDto,SendOrderDto,SupplierOrderEventDto} from './orders.dto.js';
import {createHash} from 'node:crypto';
import {ProposalMailTransport} from './proposal-mail.transport.js';
import {orderPdf} from './order-pdf.js';
import {recordOrderCost} from './order-costs.js';
const fail=(message:string)=>new DomainException('ORDINI_DA_VERIFICARE',message,HttpStatus.CONFLICT);
@Injectable()
export class CaseOrdersService {
 constructor(private readonly db:PrismaService,private readonly mail:ProposalMailTransport){}
 private async state(tx:any,seller:string,id:string){
  const project=await tx.customerCase.findFirst({where:{id,sellerId:seller}});if(!project)throw fail('Pratica non disponibile.');
  const proposal=project.confirmedProposalId?await tx.caseProposal.findFirst({where:{id:project.confirmedProposalId,caseId:id}}):null;
  const snapshot=proposal?JSON.parse(proposal.snapshot):null;
  const entries=await tx.caseFinanceEntry.findMany({where:{caseId:id},orderBy:{createdAt:'asc'}}),checks=await tx.casePaymentCheck.findMany({where:{caseId:id},orderBy:{id:'asc'}});
  const replaced=new Set(entries.flatMap((e:any)=>[e.supersedesId,e.absorbsEntryId])),latest=new Map(checks.map((c:any)=>[c.entryId,c.status]));
  const verified=entries.filter((e:any)=>!e.sourceSupportWorkId&&!replaced.has(e.id)&&e.stage==='ACTUAL'&&latest.get(e.id)==='VERIFIED').reduce((n:number,e:any)=>n+(e.kind==='CASH_IN'?e.amountCents:e.kind==='CASH_OUT'?-e.amountCents:0),0);
  const required=snapshot?.totals?.deposit;
  const items=(snapshot?.items||[]).filter((i:any)=>!i.archivedAt);
  const reasons:string[]=[];
  if(!proposal)reasons.push('Conferma prima l’offerta dopo la verifica tecnica.');
  if(!Number.isSafeInteger(required)||required<0||verified<required)reasons.push('Acconto verificato insufficiente o non definito.');
  if(!items.length)reasons.push('Nessun prodotto nella proposta confermata.');
  for(const item of items){const r=JSON.parse(item.requestedConfiguration);if(r.kind==='dealer-catalog'){const catalog=await tx.dealerCatalog.findFirst({where:{id:r.catalogId,sellerId:seller,status:'APPROVED',approvedHash:item.catalogFingerprint}});if(!catalog)reasons.push(`Catalogo non disponibile o non validato: ${item.productName}.`);}}
  return {project:{id:project.id,caseName:project.caseName,revision:project.financeRevision},proposal:proposal?{id:proposal.id,number:proposal.number}:null,items,verifiedCents:Math.max(0,verified),requiredCents:required??null,reasons,ready:!reasons.length};
 }
 async get(seller:string,id:string){return this.db.$transaction(async tx=>({...await this.state(tx,seller,id),batches:await tx.caseOrderBatch.findMany({where:{caseId:id},include:{events:{orderBy:{revision:'asc'}},deliveries:{select:{id:true,groupIndex:true,recipient:true,status:true,errorCode:true,createdAt:true,completedAt:true},orderBy:{createdAt:'desc'}}},orderBy:{createdAt:'desc'}})}));}
 async event(seller:string,id:string,batchId:string,input:SupplierOrderEventDto){
  await this.db.$transaction(async tx=>{
   const batch=await tx.caseOrderBatch.findFirst({where:{id:batchId,caseId:id,customerCase:{sellerId:seller}}});if(!batch)throw fail('Ordine non disponibile.');
   if(await tx.supplierOrderEvent.findUnique({where:{batchId_requestKey:{batchId,requestKey:input.requestKey}}}))return;
   const group=JSON.parse(batch.snapshot).groups[input.groupIndex];if(!Number.isInteger(input.groupIndex)||input.groupIndex<0||!group)throw fail('Produttore non disponibile.');
   if(!input.reviewed||!input.reference?.trim()||!input.note?.trim()||!['CONFIRMATION','RECEIPT','INVOICE'].includes(input.kind))throw fail('Conferma la verifica e indica riferimento e nota.');
   const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
   if(!validDate(input.occurredOn)||input.expectedOn&&!validDate(input.expectedOn))throw fail('Data non valida.');
   const events=await tx.supplierOrderEvent.findMany({where:{batchId,groupIndex:input.groupIndex},orderBy:{revision:'asc'}});
   if(input.kind==='CONFIRMATION'||input.kind==='INVOICE'){
    if(!Number.isSafeInteger(input.netCostCents)||input.netCostCents!<0||input.netCostCents!>100000000)throw fail('Inserisci il totale di acquisto confermato al netto IVA.');
    if(input.quantities.length)throw fail('Le quantità ricevute si registrano nella sezione arrivi.');
    if(input.kind==='INVOICE'&&!events.some(e=>e.kind==='CONFIRMATION'))throw fail('Registra prima la conferma del produttore.');
    if(input.kind==='INVOICE'&&input.expectedOn!==undefined)throw fail('La fattura non modifica la data promessa della conferma.');
   }else{
    if(!events.some(e=>e.kind==='CONFIRMATION'))throw fail('Registra prima la conferma del produttore.');
    if(input.netCostCents!==undefined||input.expectedOn!==undefined)throw fail('Gli arrivi non modificano prezzi o date promesse.');
    const ids=new Set(input.quantities.map(q=>q.itemId));if(ids.size!==input.quantities.length||ids.size!==group.lines.length||group.lines.some((l:any)=>!ids.has(l.itemId)))throw fail('Indica il totale ricevuto per ciascuna riga dell’ordine.');
    for(const q of input.quantities){const l=group.lines.find((l:any)=>l.itemId===q.itemId);if(!Number.isSafeInteger(q.received)||q.received<0||q.received>l.quantity)throw fail('Le quantità ricevute devono essere comprese tra zero e quelle ordinate.');}
   }
   const file=input.fileId?await tx.caseFile.findFirst({where:{id:input.fileId,caseId:id},select:{id:true,name:true,hash:true}}):null;if(input.fileId&&!file)throw fail('Documento originale non disponibile in questa pratica.');
   if(input.kind==='INVOICE'&&!file)throw fail('Collega il documento originale della fattura o rettifica.');
   const lock=await tx.caseOrderBatch.updateMany({where:{id:batchId,revision:input.revision},data:{revision:{increment:1}}});if(!lock.count)throw fail('L’ordine è cambiato. Ricarica prima di salvare.');
   await tx.customerCase.update({where:{id},data:{updatedAt:new Date(),...(input.kind!=='RECEIPT'?{financeRevision:{increment:1},costsComplete:false}:{})}});
   const event=await tx.supplierOrderEvent.create({data:{batchId,requestKey:input.requestKey,revision:input.revision+1,groupIndex:input.groupIndex,kind:input.kind,sellerId:seller,fileId:file?.id||null,snapshot:JSON.stringify({reference:input.reference.trim(),occurredOn:input.occurredOn,note:input.note.trim(),expectedOn:input.expectedOn||null,netCostCents:input.netCostCents??null,quantities:input.quantities,file,invoiceComplete:input.invoiceComplete??null,financeReviewed:input.financeReviewed||false,supersedesFinanceId:input.supersedesFinanceId||null,reviewedBy:seller})}});
   await recordOrderCost(tx,{caseId:id,batchId,groupIndex:input.groupIndex,eventId:event.id,kind:input.kind,supplier:group.supplier,reference:input.reference,date:input.occurredOn,amount:input.netCostCents??0,financeReviewed:input.financeReviewed,invoiceComplete:input.invoiceComplete,supersedesFinanceId:input.supersedesFinanceId,file});
  });return this.get(seller,id);
 }
 private async batch(seller:string,id:string,batchId:string){const b=await this.db.caseOrderBatch.findFirst({where:{id:batchId,caseId:id,customerCase:{sellerId:seller}}});if(!b)throw fail('Ordine non disponibile.');return b;}
 async document(seller:string,id:string,batchId:string,index:number){const b=await this.batch(seller,id,batchId);if(!Number.isInteger(index)||index<0||!JSON.parse(b.snapshot).groups[index])throw fail('Produttore non disponibile.');const archived=await this.db.supplierOrderDelivery.findFirst({where:{batchId,groupIndex:index},orderBy:{createdAt:'desc'}});if(archived)return Buffer.from(archived.pdf,'base64');try{return await orderPdf(b.id,JSON.parse(b.snapshot),index);}catch{throw fail('PDF non generabile: controlla eventuali caratteri non supportati nelle specifiche.');}}
 async preview(seller:string,id:string,batchId:string,input:OrderPreviewDto){const b=await this.batch(seller,id,batchId),s=JSON.parse(b.snapshot),group=s.groups[input.groupIndex];if(!Number.isInteger(input.groupIndex)||input.groupIndex<0||!group)throw fail('Produttore non disponibile.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient)||/[\r\n]/.test(input.recipient))throw fail('Email produttore non valida.');const recipient=input.recipient.trim(),subject=`Ordine ${b.id}/${input.groupIndex+1} - ${group.supplier}`,text=`Spett.le ${group.supplier},\n\nin allegato l’ordine ${b.id}/${input.groupIndex+1}. Vi chiediamo conferma di codici, specifiche, prezzo di acquisto e data di consegna.\n\nCordiali saluti.`;return {recipient,subject,text,configured:this.mail.status().configured,snapshotHash:createHash('sha256').update(JSON.stringify({snapshot:b.snapshot,index:input.groupIndex,recipient,subject,text})).digest('hex')};}
 async send(seller:string,id:string,batchId:string,input:SendOrderDto){
  await this.batch(seller,id,batchId);if(await this.db.supplierOrderDelivery.findUnique({where:{batchId_requestKey:{batchId,requestKey:input.requestKey}}}))return this.get(seller,id);
  const preview=await this.preview(seller,id,batchId,input);if(!preview.configured)throw fail('Invio SMTP non configurato.');if(!input.reviewed||input.snapshotHash!==preview.snapshotHash)throw fail('Controlla nuovamente destinatario e anteprima.');const pdf=await this.document(seller,id,batchId,input.groupIndex);
  const row=await this.db.$transaction(async tx=>{const state=await this.state(tx,seller,id),b=await tx.caseOrderBatch.findUniqueOrThrow({where:{id:batchId}});if(!state.ready||state.proposal?.id!==b.proposalId)throw fail('Proposta, cataloghi o acconto non consentono l’invio.');await tx.customerCase.update({where:{id},data:{updatedAt:new Date()}});const previous=await tx.supplierOrderDelivery.findUnique({where:{batchId_requestKey:{batchId,requestKey:input.requestKey}}});if(previous)return null;const attempts=await tx.supplierOrderDelivery.findMany({where:{batchId,groupIndex:input.groupIndex}});if(attempts.some(a=>a.status!=='FAILED'))throw fail('Invio già effettuato o esito incerto: verifica con il produttore prima di ripetere.');return tx.supplierOrderDelivery.create({data:{batchId,groupIndex:input.groupIndex,requestKey:input.requestKey,recipient:preview.recipient,subject:preview.subject,text:preview.text,pdf:pdf.toString('base64'),snapshotHash:preview.snapshotHash}});});if(!row)return this.get(seller,id);
  let status='UNKNOWN',errorCode:string|null=null,messageId:string|null=null;try{const r=await this.mail.send(preview.recipient,preview.subject,preview.text,pdf,`Ordine-${batchId}-${input.groupIndex+1}.pdf`);status=r.accepted?.some(a=>String(a).toLowerCase()===preview.recipient.toLowerCase())?'SMTP_ACCEPTED':'FAILED';messageId=r.messageId?.slice(0,250)||null;if(status==='FAILED')errorCode='RECIPIENT_REJECTED';}catch(e){const code=(e as {code?:string}).code||'';status=['EAUTH','EDNS','ECONNREFUSED','EENVELOPE'].includes(code)?'FAILED':'UNKNOWN';errorCode=/^[A-Z0-9_]{1,40}$/.test(code)?code:'TRANSPORT_ERROR';}await this.db.supplierOrderDelivery.update({where:{id:row.id},data:{status,errorCode,messageId,completedAt:new Date()}});return this.get(seller,id);
 }
 async prepare(seller:string,id:string,input:PrepareOrdersDto){
  await this.db.$transaction(async tx=>{
   const state=await this.state(tx,seller,id);
   if(await tx.caseOrderBatch.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:input.requestKey}}}))return;
   if(!state.ready)throw fail(state.reasons.join(' '));
   if(!input.reviewed)throw fail('Verifica produttori, codici, quantità e specifiche prima di preparare gli ordini.');
   const existing=await tx.caseOrderBatch.findFirst({where:{caseId:id,proposalId:state.proposal!.id}});if(existing)throw fail('Gli ordini di questa revisione sono già stati preparati.');
   const ids=new Set(input.lines.map(l=>l.itemId));
   if(ids.size!==input.lines.length||ids.size!==state.items.length||state.items.some((i:any)=>!ids.has(i.id)))throw fail('Inserisci esattamente una riga per ciascun prodotto della proposta confermata.');
   const groups=new Map<string,{supplier:string;lines:any[]}>();
   for(const line of input.lines){if(!line.supplier.trim()||!line.code.trim()||!line.specifications.trim()||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>10000)throw fail('Completa produttore, codice, quantità e specifiche senza dati presunti.');const key=line.supplier.trim().normalize('NFKC').toLocaleLowerCase('it-IT'),group=groups.get(key)||{supplier:line.supplier.trim(),lines:[]};const item=state.items.find((i:any)=>i.id===line.itemId);group.lines.push({itemId:item.id,brand:item.brand,productName:item.productName,configuration:JSON.parse(item.configuration),code:line.code.trim(),quantity:line.quantity,specifications:line.specifications.trim()});groups.set(key,group);}
   const lock=await tx.customerCase.updateMany({where:{id,sellerId:seller,financeRevision:input.revision,confirmedProposalId:state.proposal!.id},data:{financeRevision:{increment:1},updatedAt:new Date()}});if(!lock.count)throw fail('La pratica è cambiata. Ricarica prima di procedere.');
   const proposal=await tx.caseProposal.findUniqueOrThrow({where:{id:state.proposal!.id}}),offer=JSON.parse(proposal.snapshot);
   await tx.caseOrderBatch.create({data:{caseId:id,proposalId:state.proposal!.id,requestKey:input.requestKey,sellerId:seller,snapshot:JSON.stringify({proposal:state.proposal,dealer:offer.documentStyle?.profile?Object.fromEntries(['company','vatNumber','address','email','phone'].map(k=>[k,offer.documentStyle.profile[k]||''])):null,groups:[...groups.values()],reviewedAt:new Date().toISOString(),reviewedBy:seller})}});
  });return this.get(seller,id);
 }
}



