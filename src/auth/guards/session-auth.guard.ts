import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type AuthenticatedSeller } from '../auth.service.js';
import { DomainException } from '../../common/domain-exception.js';
import { SESSION_COOKIE_NAME } from '../auth.constants.js';

export interface RequestWithSeller extends Request {
  seller: AuthenticatedSeller;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithSeller>();
    const sessionId: unknown = req.cookies?.[SESSION_COOKIE_NAME];

    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new DomainException(
        'UNAUTHENTICATED',
        'Login richiesto.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const seller = await this.authService.validateSession(sessionId);
    if (!seller) {
      throw new DomainException(
        'SESSION_EXPIRED',
        'Sessione scaduta, effettua di nuovo il login.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    req.seller = seller;
    return true;
  }
}
