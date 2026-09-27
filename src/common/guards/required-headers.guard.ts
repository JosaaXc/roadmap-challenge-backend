import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { z } from 'zod';
import { AppException } from '../exceptions/app.exception.js';
import { ErrorCodes } from '../exceptions/error-codes.enum.js';
import { SKIP_REQUIRED_HEADERS_KEY } from '../decorators/skip-required-headers.decorator.js';

const headersSchema = z
  .looseObject({
    'x-device-id': z.string().min(1, 'Header x-device-id is strictly required.'),
    'x-app-version': z.string().min(1, 'Header x-app-version is strictly required.'),
    'x-device-os': z.string().min(1, 'Header x-device-os is strictly required.'),
    'x-latitude': z.string().min(1, 'Header x-latitude is strictly required.'),
    'x-longitude': z.string().min(1, 'Header x-longitude is strictly required.'),
  });

@Injectable()
export class RequiredHeadersGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_REQUIRED_HEADERS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const parsed = headersSchema.safeParse(request.headers);
    if (!parsed.success) {
      throw new AppException(
        ErrorCodes.MISSING_REQUIRED_HEADERS,
        'Missing or invalid mandatory context headers.',
        HttpStatus.BAD_REQUEST,
        parsed.error.issues.map((issue) => issue.message),
      );
    }

    const userAgent = request.headers['user-agent'];
    if (!userAgent) {
      throw new AppException(
        ErrorCodes.MISSING_REQUIRED_HEADERS,
        'Header User-Agent is strictly required for security.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const clientIp = request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown-ip';

    (request as Request & { clientMeta?: Record<string, unknown> }).clientMeta = {
      ip: clientIp,
      userAgent,
      deviceId: parsed.data['x-device-id'],
      appVersion: parsed.data['x-app-version'],
      deviceOs: parsed.data['x-device-os'],
    };

    return true;
  }
}
