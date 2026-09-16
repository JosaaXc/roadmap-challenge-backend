import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { tracingContext } from '../../common/middlewares/tracing.context.js';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const store = tracingContext.getStore();
    const correlationId =
      store?.correlationId ||
      (request.headers['x-correlation-id'] as string) ||
      'unknown';
    const traceId =
      store?.traceId ||
      (request.headers['x-trace-id'] as string) ||
      'unknown';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log error with full tracing context
    this.logger.error({
      err: exception,
      msg: 'Exception caught by GlobalExceptionFilter',
      correlationId,
      traceId,
      path: request.url,
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        typeof message === 'string'
          ? message
          : (message as any)?.message || message,
      correlationId,
      traceId,
    });
  }
}
