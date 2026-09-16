import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const headersSchema = z
  .object({
    'x-device-id': z
      .string()
      .min(1, 'Header x-device-id is strictly required.'),
    'x-app-version': z
      .string()
      .min(1, 'Header x-app-version is strictly required.'),
    'x-device-os': z
      .string()
      .min(1, 'Header x-device-os is strictly required.'),
    'x-latitude': z
      .string()
      .min(1, 'Header x-latitude is strictly required.'),
    'x-longitude': z
      .string()
      .min(1, 'Header x-longitude is strictly required.'),
  })
  .passthrough();

@Injectable()
export class RequiredHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 1. Zod validation for required custom headers
    const parsed = headersSchema.safeParse(req.headers);

    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => issue.message);
      throw new HttpException(
        {
          message: 'Missing or invalid mandatory context headers.',
          errors: issues,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Extra requirements like IP and User-Agent
    const clientIp =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      'unknown-ip';
    const userAgent = req.headers['user-agent'];

    if (!userAgent) {
      throw new HttpException(
        { message: 'Header User-Agent is strictly required for security.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Embed client metadata for downstream access if needed
    (req as any).clientMeta = {
      ip: clientIp,
      userAgent,
      deviceId: parsed.data['x-device-id'],
      appVersion: parsed.data['x-app-version'],
      deviceOs: parsed.data['x-device-os'],
    };

    next();
  }
}
