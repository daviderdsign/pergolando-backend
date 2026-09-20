import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainException } from '../domain-exception.js';

interface FieldError {
  field: string;
  message: string;
}

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: FieldError[];
  };
}

/** Consistent API error shape (per the PRD's "granular error recovery" requirement). */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof DomainException) {
      const status = exception.getStatus();
      const body: ApiErrorBody = {
        error: { code: exception.code, message: exception.message },
      };
      response.status(status).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const fields = extractValidationFields(raw);
      const body: ApiErrorBody = {
        error: {
          code: httpStatusCode(status),
          message: fields
            ? 'Dati non validi.'
            : messageOf(raw, exception.message),
          ...(fields ? { fields } : {}),
        },
      };
      response.status(status).json(body);
      return;
    }

    const body: ApiErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Errore interno del server.' },
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}

function messageOf(raw: unknown, fallback: string): string {
  if (typeof raw === 'object' && raw !== null && 'message' in raw) {
    const m = (raw as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return fallback;
}

function extractValidationFields(raw: unknown): FieldError[] | undefined {
  if (typeof raw !== 'object' || raw === null || !('message' in raw))
    return undefined;
  const m = (raw as { message: unknown }).message;
  if (!Array.isArray(m)) return undefined;
  // class-validator's ValidationPipe produces string messages like
  // "email must be an email" — best-effort split into field + message.
  return m
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => {
      const [field, ...rest] = entry.split(' ');
      return { field: field ?? '', message: rest.join(' ') || entry };
    });
}

function httpStatusCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'ERROR';
  }
}
