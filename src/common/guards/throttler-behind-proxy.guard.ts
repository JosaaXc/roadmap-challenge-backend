import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Behind a reverse proxy (nginx, Cloud Run's front-end, any single LB),
 * req.ip alone would resolve to the proxy's own address once `trust proxy`
 * is enabled unless we explicitly take the client-facing entry from
 * req.ips (populated from X-Forwarded-For by Express when trust proxy is
 * set - see main.ts). Falls back to req.ip when there's no proxy at all.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    return req.ips.length ? req.ips[0]! : req.ip!;
  }
}
