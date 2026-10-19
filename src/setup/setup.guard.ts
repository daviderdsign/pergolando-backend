import {Injectable,type CanActivate,type ExecutionContext,HttpStatus} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {SESSION_COOKIE_NAME} from '../auth/auth.constants.js';
import {DomainException} from '../common/domain-exception.js';
import {currentContract} from './contract.js';
@Injectable()export class SetupGuard implements CanActivate{
 constructor(private db:PrismaService){}
 async canActivate(context:ExecutionContext){
  const req=context.switchToHttp().getRequest();const path=String(req.originalUrl||req.url).split('?')[0].replace(/^\/api\/v1/,'');
  if(!/^\/(cases|dealer-catalogs|catalog|catalogs|render|scene3d|perspective|quotes|quote-document|clients)(\/|$)/.test(path))return true;
  const sessionId=req.cookies?.[SESSION_COOKIE_NAME];if(typeof sessionId!=='string')return true;
  const session=await this.db.session.findUnique({where:{id:sessionId}});if(!session||session.expiresAt<new Date())return true;
  const agreement=await this.db.dealerAgreement.findUnique({where:{sellerId_documentHash:{sellerId:session.sellerId,documentHash:currentContract().hash}}});
  const preparation=/^\/(dealer-catalogs|catalogs)(\/|$)/.test(path)||path==='/catalog'||path==='/catalog/services/status';
  const ready=preparation||!!(await this.db.dealerSetup.findUnique({where:{sellerId:session.sellerId}}))?.completedAt;
  if(!agreement||!ready)throw new DomainException('SETUP_REQUIRED','Completa la configurazione iniziale del rivenditore.',HttpStatus.FORBIDDEN);
  return true;
 }
}
