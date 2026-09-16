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
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Extract correlation and trace IDs from AsyncLocalStorage context
    const store = tracingContext.getStore();
    const correlationId =
      store?.correlationId ||
      (request.headers['x-correlation-id'] as string) ||
      'unknown';
    const traceId =
      store?.traceId ||
      (request.headers['x-trace-id'] as string) ||
      'unknown';

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR;
    let errorMessage = 'Internal server error';
    let details: Record<string, any> | any[] | undefined = undefined;

    // 2. Classify and extract exception details
    if (exception instanceof AppException) {
      // Custom application business exception
      httpStatus = exception.getStatus();
      errorCode = exception.code;
      errorMessage = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      // Standard NestJS HTTP exception (e.g. ValidationPipe errors or default HTTP exceptions)
      httpStatus = exception.getStatus();
      const resPayload = exception.getResponse();

      if (
        typeof resPayload === 'object' &&
        resPayload !== null &&
        'message' in resPayload
      ) {
        const payloadObj = resPayload as Record<string, any>;
        if (Array.isArray(payloadObj.message)) {
          // Errors originated from class-validator
          errorCode = ErrorCodes.VALIDATION_ERROR;
          errorMessage = 'Validation failed';
          details = payloadObj.message;
        } else {
          errorCode = payloadObj.error
            ? String(payloadObj.error).toUpperCase().replace(/\s+/g, '_')
            : ErrorCodes.VALIDATION_ERROR;
          errorMessage = String(payloadObj.message);
          details = payloadObj.details;
        }
      } else if (typeof resPayload === 'string') {
        errorMessage = resPayload;
      }
    } else {
      // Unhandled generic errors (500)
      this.logger.error({
        err: exception,
        msg: 'Unhandled Exception caught by GlobalExceptionFilter',
        correlationId,
        traceId,
        path: request.url,
      });
    }

    // Log error with tracing metadata
    if (httpStatus >= 500) {
      this.logger.error({
        msg: `[${errorCode}] ${errorMessage}`,
        correlationId,
        traceId,
        path: request.url,
        status: httpStatus,
        details,
      });
    } else {
      this.logger.warn({
        msg: `[${errorCode}] ${errorMessage}`,
        correlationId,
        traceId,
        path: request.url,
        status: httpStatus,
        details,
      });
    }

    // 3. Construct standard Error Envelope JSON response
    const errorBody: Record<string, any> = {
      code: errorCode,
      message: errorMessage,
    };

    if (details !== undefined && details !== null) {
      errorBody.details = details;
    }

    response.status(httpStatus).json({
      success: false,
      error: errorBody,
      correlationId,
      traceId,
      timestamp: new Date().toISOString(),
    });
  }
}
