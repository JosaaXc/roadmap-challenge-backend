import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { DiscordAuthGuard } from './discord-auth.guard.js';

/**
 * OAuth callback gate: on success behaves exactly like DiscordAuthGuard.
 * On failure (user pressed "Cancel" on Discord, expired code, provider
 * outage...), redirects back to the SPA with `?error=` instead of leaving
 * the user stranded on a backend JSON error page — the SPA owns the UX
 * for denied/failed logins.
 */
@Injectable()
export class DiscordCallbackGuard extends DiscordAuthGuard {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  override handleRequest<TUser = Record<string, unknown>>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | null {
    if (!err && user) {
      return super.handleRequest(err, user, _info, context);
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    const query = request.query as Record<string, unknown>;
    const providerError = typeof query.error === 'string' ? query.error : 'oauth_failed';
    const description =
      typeof query.error_description === 'string'
        ? query.error_description
        : err instanceof Error
          ? err.message
          : 'Discord authentication failed.';

    response.redirect(
      `${frontendUrl}/auth/callback?error=${encodeURIComponent(providerError)}&error_description=${encodeURIComponent(description)}`,
    );
    // canActivate() returns true regardless; the handler no-ops on null user.
    return null;
  }
}
