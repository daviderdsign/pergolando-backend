import {HttpStatus,Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {DomainException} from '../common/domain-exception.js';
import {DealerCatalogsService} from '../dealer-catalogs/catalogs.service.js';
import {CasesService} from './cases.service.js';
import {ImportedCaseItemDto,UpdateImportedCaseItemDto} from './imported-items.dto.js';
const fail=(message:string,status=HttpStatus.UNPROCESSABLE_ENTITY)=>new DomainException('PRODOTTO_IMPORTATO_NON_VALIDO',message,status);
@Injectable()export class ImportedCaseItemsService{
 constructor(private readonly db:PrismaService,private readonly cases:CasesService,private readonly catalogs:DealerCatalogsService){}
 async prepare(seller:string,input:ImportedCaseItemDto){
  const catalog=await this.catalogs.owned(seller,input.catalogId);
  if(catalog.status!=='APPROVED'||catalog.approvedHash!==input.catalogHash)throw fail('Seleziona una versione approvata del catalogo e ricalcola il prezzo.');
  if(!input.conditionsReviewed)throw fail('Verifica condizioni e supplementi prima di salvare.');
  const resolved=await this.catalogs.configure(seller,catalog.id,input),table=this.catalogs.table(catalog.dataset,input.tableId);
  const commercial=this.catalogs.parse(catalog.dataset).commercial;if(commercial&&input.supplements.length)throw fail("I supplementi sono calcolati dalle regole: non aggiungere importi manuali a questo catalogo.");const lines=[{descrizione:`${table.title} · ${table.source}, p. ${table.page} · L ${resolved.widthBucketCm} / P ${resolved.depthBucketCm} cm`,importo_eur:resolved.basePrice},...resolved.lines.map(x=>({descrizione:x.description+` (${x.origin.source}, p. ${x.origin.page})`,importo_eur:x.amountCents/100})),...input.supplements.map(s=>({descrizione:s.description.trim()+' (supplemento inserito dal venditore)',importo_eur:s.amountCents/100}))];
  const amountCents=Math.round(resolved.price*100)+input.supplements.reduce((sum,s)=>sum+s.amountCents,0);
  if(!Number.isSafeInteger(amountCents)||amountCents<0||amountCents>100000000)throw fail('Importo prodotto non valido o superiore al limite.');
  const configuration={prodotto:table.title,sotto_modello:table.title,variante_montaggio:'Da listino verificato',opzione_tecnica:table.title,opzioni_selezionate:resolved.selection,L_richiesta_cm:input.widthCm,P_richiesta_cm:input.depthCm,L_totale_effettiva_cm:input.widthCm,P_totale_effettiva_cm:input.depthCm,altezza_montanti_cm:input.heightCm,colore_struttura:commercial?'Vedi opzioni selezionate':input.color||'Da definire',voci_costo:lines,prezzo_totale_eur:amountCents/100,avvisi:[`Catalogo ${catalog.name} · ${catalog.brand} · versione ${catalog.version} · riferimento ${catalog.approvedHash}.`,`Fonte: ${table.source}, pagina ${table.page}. Regola prezzo: ${input.rule==='exact'?'misura esatta':'fascia superiore'}.`,commercial?`Opzioni e vincoli calcolati dalle regole della versione verificata: ${JSON.stringify(resolved.selection)}. Restano necessarie le verifiche di cantiere.`:`Supplementi espliciti inseriti dal venditore. Altezza, colori, accessori e vincoli tecnici richiedono verifica. La griglia prezzo non certifica la fattibilità della configurazione.`,...(commercial?commercial.inputs.filter(i=>i.tableIds.includes(input.tableId)&&resolved.selection[i.id]!==undefined).map(i=>i.label+': '+(i.choices?.find(c=>c.value===resolved.selection[i.id])?.label||String(resolved.selection[i.id]))):[]),...table.notes.split(/\r?\n/).filter(Boolean)]};
  const {requestKey,...requested}=input;delete (requested as Partial<UpdateImportedCaseItemDto>).version;
  return {brand:catalog.brand,productName:table.title,configuration:JSON.stringify(configuration),requestedConfiguration:JSON.stringify({...requested,kind:'dealer-catalog'}),catalogFingerprint:catalog.approvedHash!,amountCents};
 }
 async add(seller:string,id:string,input:ImportedCaseItemDto){
  await this.cases.get(seller,id);const old=await this.db.caseItem.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:input.requestKey}}});if(old)return this.cases.get(seller,id);
  const data=await this.prepare(seller,input);
  await this.db.$transaction(async tx=>{const duplicate=await tx.caseItem.findUnique({where:{caseId_requestKey:{caseId:id,requestKey:input.requestKey}}});if(duplicate)return;await this.cases.lockForProducts(tx,seller,id);await tx.caseItem.create({data:{...data,caseId:id,requestKey:input.requestKey}});await tx.customerCase.update({where:{id},data:{financeRevision:{increment:1},costsComplete:false,updatedAt:new Date()}});});return this.cases.get(seller,id);
 }
 async update(seller:string,id:string,itemId:string,input:UpdateImportedCaseItemDto){
  await this.cases.get(seller,id);const item=await this.db.caseItem.findFirst({where:{id:itemId,caseId:id}});if(!item)throw fail('Prodotto non disponibile.',HttpStatus.NOT_FOUND);
  if(JSON.parse(item.requestedConfiguration).kind!=='dealer-catalog')throw fail('Questo prodotto va modificato dal configuratore originale.');
  if(item.lastMutationKey===input.requestKey)return this.cases.get(seller,id);
  const data=await this.prepare(seller,input);
  await this.db.$transaction(async tx=>{await this.cases.lockForProducts(tx,seller,id);const updated=await tx.caseItem.updateMany({where:{id:itemId,caseId:id,version:input.version,archivedAt:null},data:{...data,version:{increment:1},lastMutationKey:input.requestKey,mediaIds:'{}'}});if(!updated.count)throw fail('Il prodotto è cambiato: riaprilo dalla pratica.',HttpStatus.CONFLICT);await tx.customerCase.update({where:{id},data:{financeRevision:{increment:1},costsComplete:false,updatedAt:new Date()}});});return this.cases.get(seller,id);
 }
}


