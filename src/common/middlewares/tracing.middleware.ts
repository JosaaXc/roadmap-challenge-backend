import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { tracingContext } from './tracing.context.js';

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract or generate Correlation ID (preserves flow across distributed services)
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();

    // Extract or generate Trace ID (identifies this specific request span)
    const traceId =
      (req.headers['x-trace-id'] as string) ||
      (req.id as string) ||
      randomUUID();

    // Inject tracing headers into the response
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-trace-id', traceId);

    // Run downstream handlers within the AsyncLocalStorage context
    tracingContext.run({ correlationId, traceId }, () => {
      next();
    });
  }
}
