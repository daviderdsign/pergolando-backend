import {OfferEmailCodeService,type OfferCodeTicket} from './offer-email-code.service.js';
import {CaseNotificationsService} from './notifications.service.js';
import {HttpStatus,Injectable,Optional} from '@nestjs/common';
import {createHash,randomBytes} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service.js';
import {DomainException} from '../common/domain-exception.js';
import {CasesService} from './cases.service.js';
import {AcceptProposalDto} from './invitations.dto.js';
const fail=(text:string,status=HttpStatus.CONFLICT)=>new DomainException('OFFERTA_NON_DISPONIBILE',text,status);
const DECLARATION='Ho letto e accetto questa revisione del preventivo, gli importi e le condizioni. Acconti e saldi saranno gestiti direttamente dal rivenditore. La conferma tecnica finale spetta al rivenditore.';
const emailCodeRequired=()=>process.env.OFFER_EMAIL_VERIFICATION_REQUIRED==='true';
@Injectable()export class ProposalInvitationsService{
 constructor(private readonly db:PrismaService,private readonly cases:CasesService,@Optional() private readonly notifications?:CaseNotificationsService,@Optional() private readonly emailCode?:OfferEmailCodeService){}
 async list(seller:string,id:string){await this.cases.get(seller,id);return this.db.proposalInvitation.findMany({where:{proposal:{caseId:id}},select:{id:true,proposalId:true,expiresAt:true,revokedAt:true,acceptedAt:true,acceptedName:true,acceptedEmail:true,emailVerifiedAt:true,acceptanceText:true,confirmedAt:true,rejectedAt:true,decisionNote:true,createdAt:true},orderBy:{createdAt:'desc'}});}
 async create(seller:string,id:string,proposalId:string){
  await this.cases.get(seller,id);const token=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(token).digest('hex');
  const value=await this.db.$transaction(async tx=>{
   const lock=await tx.customerCase.updateMany({where:{id,sellerId:seller,acceptedProposalId:null,confirmedProposalId:null},data:{updatedAt:new Date()}});if(!lock.count)throw fail('La pratica ha già un’offerta accettata: gestisci prima la conferma o il rifiuto.');
   const proposal=await tx.caseProposal.findFirst({where:{id:proposalId,caseId:id}});if(!proposal)throw fail('Revisione non disponibile.',HttpStatus.NOT_FOUND);
   const snapshot=JSON.parse(proposal.snapshot),end=new Date(snapshot.terms.validUntil+'T23:59:59.999Z');if(!Number.isFinite(end.getTime())||end<new Date())throw fail('Questa revisione è scaduta. Creane una nuova.');
   await tx.proposalInvitation.updateMany({where:{proposal:{caseId:id},acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
   return tx.proposalInvitation.create({data:{proposalId,tokenHash,expiresAt:new Date(Date.now()+30*86400000)},select:{id:true,expiresAt:true}});
  });return {...value,token};
 }
 async lookup(token:string){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw fail('Collegamento non disponibile.',HttpStatus.NOT_FOUND);
  const value=await this.db.proposalInvitation.findUnique({where:{tokenHash:createHash('sha256').update(token).digest('hex')},include:{proposal:{include:{customerCase:true}}}});
  if(!value||value.revokedAt||value.expiresAt<new Date())throw fail('Collegamento scaduto o revocato. Contatta il rivenditore.',HttpStatus.NOT_FOUND);return value;
 }
 async view(token:string){const invitation=await this.lookup(token),snapshot=JSON.parse(invitation.proposal.snapshot);const items=snapshot.items.map((item:{brand:string;productName:string;amountCents:number;configuration:string;mediaIds?:string})=>({brand:item.brand,productName:item.productName,amountCents:item.amountCents,configuration:item.configuration,mediaIds:item.mediaIds||'{}'}));return {proposal:{number:invitation.proposal.number,createdAt:invitation.proposal.createdAt,snapshot:JSON.stringify({...snapshot,items})},declaration:DECLARATION,emailCodeRequired:emailCodeRequired(),expiresAt:invitation.expiresAt,acceptedAt:invitation.acceptedAt,acceptedName:invitation.acceptedName,emailVerifiedAt:invitation.emailVerifiedAt,confirmedAt:invitation.confirmedAt,rejectedAt:invitation.rejectedAt,decisionNote:invitation.decisionNote,validUntil:snapshot.terms.validUntil};}
 async media(token:string,mediaId:string){const invitation=await this.lookup(token),snapshot=JSON.parse(invitation.proposal.snapshot);const allowed=snapshot.items.some((item:{mediaIds?:string})=>Object.values(JSON.parse(item.mediaIds||'{}')).includes(mediaId));if(!allowed)throw fail('Immagine non disponibile.',HttpStatus.NOT_FOUND);const value=await this.db.caseMedia.findFirst({where:{id:mediaId,caseId:invitation.proposal.caseId}});if(!value)throw fail('Immagine non disponibile.',HttpStatus.NOT_FOUND);return{data:value.data,mimeType:value.mimeType};}
 async requestCode(token:string,email:string){const invitation=await this.lookup(token);if(invitation.acceptedAt||invitation.rejectedAt)throw fail('Questa proposta ha già un esito.');const snapshot=JSON.parse(invitation.proposal.snapshot);if(new Date(snapshot.terms.validUntil+'T23:59:59.999Z')<new Date())throw fail('Proposta scaduta.');if(snapshot.client.email&&snapshot.client.email.trim().toLowerCase()!==email.trim().toLowerCase())throw fail('Usa l’email indicata nel preventivo.');if(!this.emailCode)throw fail('Verifica email non disponibile.',HttpStatus.SERVICE_UNAVAILABLE);return this.emailCode.request(invitation.id,email);}
 async accept(token:string,input:AcceptProposalDto){const invitation=await this.lookup(token);if(!input.reviewed||!input.name.trim())throw fail('Leggi e conferma le condizioni.');if(invitation.rejectedAt)throw fail('Questa richiesta è stata rifiutata. Richiedi una nuova offerta.');if(invitation.acceptedAt)return this.view(token);
  const snapshot=JSON.parse(invitation.proposal.snapshot);if(new Date(snapshot.terms.validUntil+'T23:59:59.999Z')<new Date())throw fail('Il preventivo è scaduto. Richiedi una nuova revisione.');
  if(snapshot.client.email&&snapshot.client.email.trim().toLowerCase()!==input.email.trim().toLowerCase())throw fail('Usa l’indirizzo email indicato nel preventivo.');
  let ticket:OfferCodeTicket|undefined;
  if(emailCodeRequired()||input.code!==undefined){if(!this.emailCode)throw fail('Verifica email non disponibile.',HttpStatus.SERVICE_UNAVAILABLE);ticket=await this.emailCode.verify(invitation.id,input.email,input.code||'');}
  await this.db.$transaction(async tx=>{
   if(ticket)await this.emailCode!.consume(tx,ticket);
   const lock=await tx.customerCase.updateMany({where:{id:invitation.proposal.caseId,acceptedProposalId:null,confirmedProposalId:null},data:{acceptedProposalId:invitation.proposalId,updatedAt:new Date()}});if(!lock.count)throw fail('Esiste già una richiesta accettata per questa pratica. Ricarica la pagina.');
   const updated=await tx.proposalInvitation.updateMany({where:{id:invitation.id,revokedAt:null,acceptedAt:null,rejectedAt:null,expiresAt:{gt:new Date()}},data:{acceptedAt:new Date(),emailVerifiedAt:ticket?new Date():null,acceptedName:input.name.trim(),acceptedEmail:input.email.trim().toLowerCase(),acceptanceText:DECLARATION}});if(!updated.count)throw fail('Il collegamento è cambiato. Ricarica la pagina.');await this.notifications?.enqueue(tx,{caseId:invitation.proposal.caseId,invitationId:invitation.id,kind:'CLIENT_ACCEPTED',sellerId:invitation.proposal.customerCase.sellerId,clientEmail:input.email,customer:input.name.trim(),number:invitation.proposal.number});await this.notifications?.enqueue(tx,{caseId:invitation.proposal.caseId,invitationId:invitation.id,kind:'CLIENT_ACCEPTANCE_RECEIPT',sellerId:invitation.proposal.customerCase.sellerId,clientEmail:input.email,customer:input.name.trim(),number:invitation.proposal.number});
  });return this.view(token);
 }
 async revoke(seller:string,id:string,invitationId:string){await this.cases.get(seller,id);const changed=await this.db.proposalInvitation.updateMany({where:{id:invitationId,proposal:{caseId:id},acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});if(!changed.count)throw fail('Collegamento già revocato o accettato.');return this.list(seller,id);}
 async decide(seller:string,id:string,invitationId:string,confirm:boolean,note:string){await this.cases.get(seller,id);await this.db.$transaction(async tx=>{
  const invitation=await tx.proposalInvitation.findFirst({where:{id:invitationId,proposal:{caseId:id}}});if(!invitation||!invitation.acceptedAt||invitation.revokedAt)throw fail('Serve prima la richiesta di accettazione del cliente.');if(invitation.confirmedAt||invitation.rejectedAt){if((confirm&&invitation.confirmedAt)||(!confirm&&invitation.rejectedAt))return;throw fail('Decisione già registrata.');}if(!confirm&&!note.trim())throw fail('Indica il motivo del rifiuto.');
  const changed=await tx.customerCase.updateMany({where:{id,sellerId:seller,acceptedProposalId:invitation.proposalId,confirmedProposalId:null},data:confirm?{confirmedProposalId:invitation.proposalId,updatedAt:new Date()}:{acceptedProposalId:null,updatedAt:new Date()}});if(!changed.count)throw fail('Lo stato della pratica è cambiato.');
  await tx.proposalInvitation.update({where:{id:invitation.id},data:{...(confirm?{confirmedAt:new Date()}:{rejectedAt:new Date()}),decisionNote:note.trim()}});const proposal=await tx.caseProposal.findUniqueOrThrow({where:{id:invitation.proposalId}});await this.notifications?.enqueue(tx,{caseId:id,invitationId:invitation.id,kind:confirm?'SELLER_CONFIRMED':'SELLER_REJECTED',sellerId:seller,clientEmail:invitation.acceptedEmail||'',customer:invitation.acceptedName||'',number:proposal.number,note:note.trim()});
 });return this.list(seller,id);}
}

