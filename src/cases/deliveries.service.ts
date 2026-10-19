import {HttpStatus,Injectable} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {ProposalMailTransport} from './proposal-mail.transport.js';
export {ProposalMailTransport} from './proposal-mail.transport.js';
import {Equals,IsString,IsUUID,Matches,MaxLength} from 'class-validator';
import {PrismaService} from '../prisma/prisma.service.js';
import {CasesService} from './cases.service.js';
import {ProposalInvitationsService} from './invitations.service.js';
import {DomainException} from '../common/domain-exception.js';
export class SendProposalDto{
 @IsUUID() requestKey!:string;
 @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) invitationToken!:string;
 @IsString() @Matches(/^[a-f0-9]{64}$/) snapshotHash!:string;
 @IsString() @MaxLength(11000000) pdfBase64!:string;
 @Equals(true) reviewed!:boolean;
}
const fail=(message:string,status=HttpStatus.UNPROCESSABLE_ENTITY)=>new DomainException('INVIO_OFFERTA',message,status);
const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
@Injectable()export class ProposalDeliveriesService{
 constructor(private readonly db:PrismaService,private readonly cases:CasesService,private readonly invitations:ProposalInvitationsService,private readonly mail:ProposalMailTransport){}
 status(){return this.mail.status();}
 async proposal(seller:string,id:string,proposalId:string){await this.cases.get(seller,id);const value=await this.db.caseProposal.findFirst({where:{id:proposalId,caseId:id}});if(!value)throw fail('Revisione non disponibile.',HttpStatus.NOT_FOUND);return value;}
 async list(seller:string,id:string,proposalId:string){await this.proposal(seller,id,proposalId);return this.db.proposalDelivery.findMany({where:{proposalId},select:{id:true,recipient:true,subject:true,snapshotHash:true,pdfHash:true,status:true,messageId:true,errorCode:true,createdAt:true,completedAt:true,invitationId:true},orderBy:{createdAt:'desc'}});}
 async prepare(seller:string,id:string,proposalId:string,token:string){const proposal=await this.proposal(seller,id,proposalId),invitation=await this.invitations.lookup(token);if(invitation.proposalId!==proposalId||invitation.proposal.customerCase.sellerId!==seller)throw fail('Collegamento non associato a questa revisione.');if(invitation.acceptedAt||invitation.rejectedAt)throw fail('Questa offerta ha già una richiesta del cliente.');const snapshot=JSON.parse(proposal.snapshot);if(new Date(snapshot.terms.validUntil+'T23:59:59.999Z')<new Date())throw fail('Offerta scaduta.');const recipient=String(snapshot.client.email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw fail('Manca un’email cliente valida nella revisione. Crea una nuova offerta con i dati completi.');const config=this.mail.status(),subject=`Il tuo preventivo Pergolando · revisione ${proposal.number}`;const text=`Gentile ${snapshot.client.firstName} ${snapshot.client.lastName},\n\nin allegato trovi il preventivo, revisione ${proposal.number}, valido fino al ${snapshot.terms.validUntil}.\n\nPuoi consultare la stessa proposta e richiedere la conferma al rivenditore qui:\n${config.publicAppUrl}/offerta#${token}\n\nAcconti e saldi sono gestiti direttamente dal rivenditore.\nGrazie per il tuo interessamento.`;return {recipient,subject,text,snapshotHash:digest(proposal.snapshot),configured:config.configured,proposal,invitation};}
 async preview(seller:string,id:string,proposalId:string,token:string){const {proposal,invitation,...preview}=await this.prepare(seller,id,proposalId,token);return preview;}
 async send(seller:string,id:string,proposalId:string,input:SendProposalDto){
  await this.proposal(seller,id,proposalId);const old=await this.db.proposalDelivery.findUnique({where:{proposalId_requestKey:{proposalId,requestKey:input.requestKey}}});if(old)return this.list(seller,id,proposalId);
  const prepared=await this.prepare(seller,id,proposalId,input.invitationToken);if(!prepared.configured)throw fail('Invio SMTP non configurato.',HttpStatus.SERVICE_UNAVAILABLE);if(!input.reviewed||input.snapshotHash!==prepared.snapshotHash)throw fail('La revisione non corrisponde all’anteprima controllata.');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(input.pdfBase64))throw fail('Documento PDF non valido.');const bytes=Buffer.from(input.pdfBase64,'base64');if(bytes.length>8*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-100).toString().includes('%%EOF'))throw fail('PDF non valido o superiore a 8 MB.');
  const row=await this.db.$transaction(async tx=>{const lock=await tx.customerCase.updateMany({where:{id,sellerId:seller,acceptedProposalId:null,confirmedProposalId:null},data:{updatedAt:new Date()}});if(!lock.count)throw fail('Lo stato della pratica è cambiato.');const active=await tx.proposalInvitation.findFirst({where:{id:prepared.invitation.id,revokedAt:null,acceptedAt:null,expiresAt:{gt:new Date()}}});if(!active)throw fail('Collegamento non più valido.');const previous=await tx.proposalDelivery.findUnique({where:{proposalId_requestKey:{proposalId,requestKey:input.requestKey}}});if(previous)return {value:previous,new:false};if(await tx.proposalDelivery.findFirst({where:{proposalId,status:'SENDING',createdAt:{gt:new Date(Date.now()-120000)}}}))throw fail('È già in corso un invio per questa revisione. Aggiorna lo stato prima di riprovare.',HttpStatus.CONFLICT);const value=await tx.proposalDelivery.create({data:{proposalId,requestKey:input.requestKey,invitationId:active.id,recipient:prepared.recipient,subject:prepared.subject,text:prepared.text.replace(input.invitationToken,'[segreto del collegamento non archiviato]'),snapshotHash:prepared.snapshotHash,pdfHash:digest(bytes),pdf:input.pdfBase64}});return {value,new:true};});
  if(!row.new)return this.list(seller,id,proposalId);
  let status='UNKNOWN',messageId:string|null=null,errorCode:string|null=null;
  try{const result=await this.mail.send(prepared.recipient,prepared.subject,prepared.text,bytes,`Preventivo-revisione-${prepared.proposal.number}.pdf`);status=result.accepted?.some(address=>String(address).toLowerCase()===prepared.recipient.toLowerCase())?'SMTP_ACCEPTED':'FAILED';messageId=result.messageId?.slice(0,250)||null;if(status==='FAILED')errorCode='RECIPIENT_REJECTED';}
  catch(error){const code=(error as {code?:string}).code||'';status=['EAUTH','ECONNECTION','EDNS','ECONNREFUSED','EENVELOPE'].includes(code)?'FAILED':'UNKNOWN';errorCode=/^[A-Z0-9_]{1,40}$/.test(code)?code:'TRANSPORT_ERROR';}
  await this.db.proposalDelivery.update({where:{id:row.value.id},data:{status,messageId,errorCode,completedAt:new Date()}});return this.list(seller,id,proposalId);
 }
 async document(seller:string,id:string,proposalId:string,deliveryId:string){await this.proposal(seller,id,proposalId);const row=await this.db.proposalDelivery.findFirst({where:{id:deliveryId,proposalId}});if(!row)throw fail('Documento non disponibile.',HttpStatus.NOT_FOUND);return row;}
}
