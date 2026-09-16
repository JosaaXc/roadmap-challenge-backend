import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Documents a success response wrapped in our global envelope
 * ({ success: true, data, meta: { timestamp } }), exactly as produced by
 * ResponseTransformInterceptor - a bare @ApiResponse() would otherwise
 * document the raw controller return value, which is never what actually
 * reaches the client.
 */
export function ApiEnvelopeResponse<TModel extends Type<unknown>>(
  status: number,
  description: string,
  model?: TModel,
  options?: { isArray?: boolean },
) {
  const dataSchema = options?.isArray
    ? {
        type: 'array' as const,
        items: model ? { $ref: getSchemaPath(model) } : { type: 'object' as const },
      }
    : model
      ? { $ref: getSchemaPath(model) }
      : { type: 'object' as const, nullable: true };

  const decorators = [
    ApiResponse({
      status,
      description,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: dataSchema,
          meta: {
            type: 'object',
            properties: { timestamp: { type: 'string', format: 'date-time' } },
          },
        },
      },
    }),
  ];

  if (model) {
    decorators.unshift(ApiExtraModels(model));
  }

  return applyDecorators(...decorators);
}

/**
 * Documents an error response exactly as produced by GlobalExceptionFilter:
 * { success: false, error: { code, message, details? }, correlationId, traceId, timestamp }.
 */
export function ApiEnvelopeError(status: number, description: string, exampleCode?: string) {
  return ApiResponse({
    status,
    description,
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: exampleCode ?? 'VALIDATION_ERROR' },
            message: { type: 'string' },
            details: { type: 'object', nullable: true },
          },
        },
        correlationId: { type: 'string', format: 'uuid' },
        traceId: { type: 'string', format: 'uuid' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  });
}
