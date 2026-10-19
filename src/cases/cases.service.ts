import {Injectable,HttpStatus} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service.js';
import {BundleService} from '../bundle/bundle.service.js';
import {DomainException} from '../common/domain-exception.js';
import {CreateCaseDto,AddCaseItemDto,UpdateCaseItemDto,ArchiveCaseItemDto,CreateProposalDto} from './cases.dto.js';
@Injectable()
export class CasesService {
 constructor(private readonly db:PrismaService,private readonly bundle:BundleService){}
 list(sellerId:string){return this.db.customerCase.findMany({where:{sellerId},orderBy:{updatedAt:'desc'},include:{items:true},take:100});}
 async get(sellerId:string,id:string){const value=await this.db.customerCase.findFirst({where:{id,sellerId},include:{items:{orderBy:{createdAt:'asc'}}}});if(!value)throw new DomainException('PRATICA_NON_TROVATA','Pratica non disponibile.',HttpStatus.NOT_FOUND);return value;}
 async create(sellerId:string,input:CreateCaseDto){
  if(!input.firstName.trim()||!input.lastName.trim()||input.caseName!==undefined&&!input.caseName.trim())throw new DomainException('DATI_CLIENTE','Inserisci nome e cognome del referente.',HttpStatus.UNPROCESSABLE_ENTITY);
  const data={sellerId,firstName:input.firstName.trim(),lastName:input.lastName.trim(),email:input.email?.trim()||'',phone:input.phone.trim(),address:input.address.trim(),caseName:input.caseName?.trim()||'',companyName:input.companyName?.trim()||'',siteAddress:input.siteAddress?.trim()||'',projectNotes:input.projectNotes?.trim()||''};
  if(input.creationKey)return this.db.customerCase.upsert({where:{sellerId_creationKey:{sellerId,creationKey:input.creationKey}},create:{...data,creationKey:input.creationKey},update:{},include:{items:true}});
  return this.db.customerCase.create({data,include:{items:true}});
 }
 async progress(sellerId:string,id:string){const project=await this.db.customerCase.findFirst({where:{id,sellerId},select:{id:true,caseName:true,acceptedProposalId:true,confirmedProposalId:true,deliveredAt:true,items:{select:{archivedAt:true}}}});if(!project)throw new DomainException('PRATICA_NON_TROVATA','Pratica non disponibile.',HttpStatus.NOT_FOUND);return {...project,offers:await this.db.caseProposal.count({where:{caseId:id}})};}
 async lockForProducts(tx:Prisma.TransactionClient,seller:string,id:string){const lock=await tx.customerCase.updateMany({where:{id,sellerId:seller,acceptedProposalId:null,confirmedProposalId:null},data:{updatedAt:new Date()}});if(!lock.count)throw new DomainException('TRATTATIVA_DA_RIAPRIRE','Questa pratica ha una proposta accettata o confermata. Gestisci prima la trattativa; le varianti dopo conferma non sono ancora disponibili.',HttpStatus.CONFLICT);}
 async add(sellerId:string,id:string,input:AddCaseItemDto){
  await this.get(sellerId,id);
  const previous=await this.db.caseItem.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:input.requestKey}}});if(previous)return this.get(sellerId,id);
  const {requestKey,...requested}=input;const brand=input.catalogo||'arquati';const configuration=this.bundle.configura(requested,brand);const catalog=this.bundle.getCatalog(brand);
  const amountCents=Math.round(configuration.prezzo_totale_eur*100);if(!Number.isSafeInteger(amountCents)||amountCents<0)throw new DomainException('PREZZO_NON_VALIDO','Prezzo non valido.',HttpStatus.UNPROCESSABLE_ENTITY);
  await this.db.$transaction(async tx=>{if(await tx.caseItem.findUnique({where:{caseId_requestKey:{caseId:id,requestKey}}}))return;await this.lockForProducts(tx,sellerId,id);await tx.caseItem.create({data:{caseId:id,requestKey,brand,productName:catalog.sotto_modelli[input.sottoModello]?.nome||catalog.prodotto.nome,configuration:JSON.stringify(configuration),requestedConfiguration:JSON.stringify(requested),catalogFingerprint:createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),amountCents}});await tx.customerCase.update({where:{id},data:{updatedAt:new Date(),costsComplete:false,financeRevision:{increment:1}}});});
  return this.get(sellerId,id);
 }
 async updateItem(seller:string,id:string,itemId:string,input:UpdateCaseItemDto){
  await this.get(seller,id);const item=await this.db.caseItem.findFirst({where:{id:itemId,caseId:id}});if(!item)throw new DomainException('PRODOTTO_NON_TROVATO','Prodotto non disponibile.',HttpStatus.NOT_FOUND);if(JSON.parse(item.requestedConfiguration).kind==='dealer-catalog')throw new DomainException('CONFIGURATORE_ERRATO','Apri questo prodotto dal catalogo importato.',HttpStatus.UNPROCESSABLE_ENTITY);if(item.lastMutationKey===input.requestKey)return this.get(seller,id);
  const {version,requestKey,...requested}=input;const brand=input.catalogo||'arquati';const configuration=this.bundle.configura(requested,brand),catalog=this.bundle.getCatalog(brand);const amountCents=Math.round(configuration.prezzo_totale_eur*100);
  if(!Number.isSafeInteger(amountCents)||amountCents<0)throw new DomainException('PREZZO_NON_VALIDO','Prezzo non valido.',HttpStatus.UNPROCESSABLE_ENTITY);
  await this.db.$transaction(async tx=>{await this.lockForProducts(tx,seller,id);const changed=await tx.caseItem.updateMany({where:{id:itemId,caseId:id,version,archivedAt:null},data:{version:{increment:1},mediaIds:'{}',lastMutationKey:requestKey,brand,productName:catalog.sotto_modelli[input.sottoModello]?.nome||catalog.prodotto.nome,configuration:JSON.stringify(configuration),requestedConfiguration:JSON.stringify(requested),catalogFingerprint:createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),amountCents}});if(!changed.count)throw new DomainException('VERSIONE_SUPERATA','Il prodotto è cambiato. Riaprilo dall’archivio.',HttpStatus.CONFLICT);await tx.customerCase.update({where:{id},data:{costsComplete:false,financeRevision:{increment:1},updatedAt:new Date()}});});return this.get(seller,id);
 }
 async archiveItem(seller:string,id:string,itemId:string,input:ArchiveCaseItemDto){await this.get(seller,id);await this.db.$transaction(async tx=>{await this.lockForProducts(tx,seller,id);const changed=await tx.caseItem.updateMany({where:{id:itemId,caseId:id,version:input.version},data:{archivedAt:input.archived?new Date():null,version:{increment:1}}});if(!changed.count)throw new DomainException('VERSIONE_SUPERATA','Ricarica la pratica prima di modificare il prodotto.',HttpStatus.CONFLICT);await tx.customerCase.update({where:{id},data:{costsComplete:false,financeRevision:{increment:1},updatedAt:new Date()}});});return this.get(seller,id);}
 async proposals(seller:string,id:string){await this.get(seller,id);return this.db.caseProposal.findMany({where:{caseId:id},orderBy:{number:'desc'}});}
 async proposal(seller:string,id:string,input:CreateProposalDto){await this.get(seller,id);const old=await this.db.caseProposal.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:input.requestKey}}});if(old)return old;
  const parsed=new Date(input.validUntil+'T12:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==input.validUntil)throw new DomainException('DATA_NON_VALIDA','Validità offerta non valida.',HttpStatus.UNPROCESSABLE_ENTITY);
  return this.db.$transaction(async tx=>{const previous=await tx.caseProposal.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:input.requestKey}}});if(previous)return previous;const project=await tx.customerCase.findFirst({where:{id,sellerId:seller},include:{items:{where:{archivedAt:null},orderBy:{createdAt:'asc'}}}});if(!project||!project.items.length)throw new DomainException('PRATICA_VUOTA','Aggiungi almeno un prodotto.',HttpStatus.UNPROCESSABLE_ENTITY);
   const locked=await tx.customerCase.updateMany({where:{id,sellerId:seller,financeRevision:input.revision,acceptedProposalId:null,confirmedProposalId:null},data:{proposalRevision:{increment:1},financeRevision:{increment:1},updatedAt:new Date()}});if(!locked.count){if(project.acceptedProposalId||project.confirmedProposalId)throw new DomainException('TRATTATIVA_DA_RIAPRIRE','Una proposta è già accettata o confermata. Gestisci la trattativa prima di creare altre revisioni.',HttpStatus.CONFLICT);throw new DomainException('VERSIONE_SUPERATA','La pratica è cambiata: ricarica prima di creare la revisione.',HttpStatus.CONFLICT);}
   const subtotal=project.items.reduce((total,item)=>total+item.amountCents,0);const discount=Math.round(subtotal*input.discountBps/10000);const taxable=subtotal-discount+input.installationCents+input.transportCents;const vat=Math.round(taxable*input.vatBps/10000);const total=taxable+vat;const deposit=Math.round(total*input.depositBps/10000);
   const setup=await tx.dealerSetup.findUnique({where:{sellerId:seller}});let documentStyle;
   if(setup){const profile=JSON.parse(setup.profile);documentStyle={revision:setup.revision,profile:{company:profile.company,vatNumber:profile.vatNumber,address:profile.address,email:profile.email,phone:profile.phone,letterhead:{...profile.letterhead,pdf:''}}};}
   const snapshot={documentStyle,project:{caseName:project.caseName,siteAddress:project.siteAddress},client:{companyName:project.companyName,firstName:project.firstName,lastName:project.lastName,email:project.email,phone:project.phone,address:project.address},items:project.items,terms:input,totals:{subtotal,discount,taxable,vat,total,deposit,balance:total-deposit},createdAt:new Date().toISOString()};
   return tx.caseProposal.create({data:{caseId:id,number:project.proposalRevision+1,requestKey:input.requestKey,snapshot:JSON.stringify(snapshot)}});
  });
 }

}

