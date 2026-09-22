import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { AppException } from '../exceptions/app.exception.js';
import { ErrorCodes } from '../exceptions/error-codes.enum.js';
import { getAuthContext } from '../middlewares/tracing.context.js';
import { RedisService } from '../../core/cache/redis.service.js';
import { IDEMPOTENT_KEY, IdempotentOptions } from '../decorators/idempotent.decorator.js';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

interface IdempotencyRecord {
  state: 'IN_PROGRESS' | 'COMPLETED';
  status?: number;
  body?: unknown;
}

const idempotencyCacheKey = (userId: string, idempotencyKey: string): string =>
  `idempotency:${userId}:${idempotencyKey}`;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) { }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.get<IdempotentOptions | undefined>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const required = options.required ?? true;
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER] as string | undefined;

    if (!idempotencyKey) {
      if (!required) {
        return next.handle();
      }
      throw new AppException(
        ErrorCodes.MISSING_IDEMPOTENCY_KEY,
        `The '${IDEMPOTENCY_KEY_HEADER}' header is required for this operation.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const userId = getAuthContext()?.userId ?? 'anonymous';
    const cacheKey = idempotencyCacheKey(userId, idempotencyKey);

    const existing = await this.redis.get<IdempotencyRecord>(cacheKey);

    if (existing?.state === 'COMPLETED') {
      const response = context.switchToHttp().getResponse<Response>();
      response.status(existing.status ?? HttpStatus.OK);
      return of(existing.body);
    }

    if (existing?.state === 'IN_PROGRESS') {
      throw new AppException(
        ErrorCodes.IDEMPOTENT_REQUEST_IN_PROGRESS,
        'A request with this Idempotency-Key is already being processed.',
        HttpStatus.CONFLICT,
      );
    }

    const lockTtlSeconds = this.configService.get<number>('IDEMPOTENCY_LOCK_TTL_SECONDS', 60);
    await this.redis.set(cacheKey, { state: 'IN_PROGRESS' } satisfies IdempotencyRecord, lockTtlSeconds);

    const ttlSeconds =
      options.ttlSeconds ?? this.configService.get<number>('IDEMPOTENCY_DEFAULT_TTL_SECONDS', 86_400);

    return next.handle().pipe(
      mergeMap((body) => {
        const status =
          this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler()) ??
          (request.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);

        const record: IdempotencyRecord = { state: 'COMPLETED', status, body };
        return from(this.redis.set(cacheKey, record, ttlSeconds)).pipe(mergeMap(() => of(body)));
      }),
      catchError((err) => from(this.redis.del(cacheKey)).pipe(mergeMap(() => throwError(() => err)))),
    );
  }
}
