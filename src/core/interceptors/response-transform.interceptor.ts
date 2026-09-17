import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_RESPONSE_ENVELOPE_KEY } from '../../common/decorators/skip-response-envelope.decorator.js';

export interface StandardSuccessResponse<T> {
  success: true;
  data: T;
  meta: Record<string, any>;
}

/**
 * Global Interceptor to wrap controller responses in a standardized Envelope payload.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardSuccessResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardSuccessResponse<T> | T> {
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipEnvelope) {
      return next.handle();
    }

    return next.handle().pipe(
      map((resData) => {
        const timestamp = new Date().toISOString();

        if (
          resData &&
          typeof resData === 'object' &&
          !Array.isArray(resData) &&
          'items' in resData &&
          'meta' in resData
        ) {
          const { items, meta, ...otherKeys } = resData as Record<string, any>;
          return {
            success: true,
            data: { items, ...otherKeys } as unknown as T,
            meta: {
              timestamp,
              ...meta,
            },
          };
        }

        return {
          success: true,
          data: (resData ?? null) as T,
          meta: {
            timestamp,
          },
        };
      }),
    );
  }
}
