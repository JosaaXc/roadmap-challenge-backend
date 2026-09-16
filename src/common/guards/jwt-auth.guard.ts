import {
  ExecutionContext,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/is-public.decorator.js';
import { AppException } from '../exceptions/app.exception.js';
import { ErrorCodes } from '../exceptions/error-codes.enum.js';
import { setAuthContext } from '../middlewares/tracing.context.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { RedisService } from '../../core/cache/redis.service.js';
import { sessionCacheKey } from '../cache/cache-keys.util.js';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface.js';

interface CachedSession {
  userId: string;
  username: string;
  roleId: string;
  isActive: boolean;
}

/**
 * Global Zero Trust gate: every route requires a valid RS256-signed access
 * token unless explicitly marked with @IsPublic(). On success, injects the
 * authenticated principal into the request-scoped AsyncLocalStorage so
 * downstream code (services, guards, interceptors) never needs parameter
 * drilling to know "who is calling".
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    let isValid: boolean;
    try {
      isValid = (await super.canActivate(context)) as boolean;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        const message = (err.getResponse() as any)?.message ?? err.message;
        const isExpired =
          typeof message === 'string' && /jwt expired/i.test(message);

        throw new AppException(
          isExpired ? ErrorCodes.TOKEN_EXPIRED : ErrorCodes.INVALID_TOKEN,
          isExpired
            ? 'Access token has expired.'
            : 'Access token is missing, malformed or invalid.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw err;
    }

    if (!isValid) {
      throw new AppException(
        ErrorCodes.UNAUTHORIZED,
        'Authentication failed.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const payload = request.user as JwtPayload;

    const session = await this.resolveSession(payload);

    if (!session.isActive) {
      throw new AppException(
        ErrorCodes.USER_INACTIVE,
        'This user account has been deactivated.',
        HttpStatus.FORBIDDEN,
      );
    }

    setAuthContext({
      userId: session.userId,
      username: session.username,
      roleId: session.roleId,
    });
    request.user = session;

    return true;
  }

  /**
   * Cache-Aside pattern keyed by (userId, jti): the first request for a
   * given access token hits Postgres once and caches the resolved session
   * for the remainder of that token's lifetime (bounded by
   * JWT_SESSION_CACHE_TTL_SECONDS), so subsequent requests on the same
   * token never touch the database.
   */
  private async resolveSession(payload: JwtPayload): Promise<CachedSession> {
    const cacheKey = sessionCacheKey(payload.sub, payload.jti);
    const cached = await this.redis.get<CachedSession>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, roleId: true, isActive: true },
    });

    if (!user) {
      throw new AppException(
        ErrorCodes.USER_NOT_FOUND,
        'The user associated with this token no longer exists.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const session: CachedSession = {
      userId: user.id,
      username: user.username,
      roleId: user.roleId,
      isActive: user.isActive,
    };

    await this.redis.set(cacheKey, session, this.ttlForToken(payload));

    return session;
  }

  private ttlForToken(payload: JwtPayload): number {
    const maxTtl = this.configService.get<number>(
      'JWT_SESSION_CACHE_TTL_SECONDS',
      900,
    );

    if (!payload.exp) {
      return maxTtl;
    }

    const remaining = payload.exp - Math.floor(Date.now() / 1000);
    return Math.max(1, Math.min(remaining, maxTtl));
  }
}
