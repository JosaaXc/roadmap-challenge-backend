import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  implements NestInterceptor<T, StandardSuccessResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardSuccessResponse<T>> {
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
