import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Every domain-level error (not a generic validation failure) throws this,
 * so the API's error shape stays consistent: { error: { code, message } }.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super(message, status);
  }
}
