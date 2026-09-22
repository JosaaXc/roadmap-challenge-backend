import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { AppException } from '../exceptions/app.exception.js';
import { ErrorCodes } from '../exceptions/error-codes.enum.js';
import { getAuthContext } from '../middlewares/tracing.context.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { RedisService } from '../../core/cache/redis.service.js';
import { rolePermissionsCacheKey } from '../cache/cache-keys.util.js';

const ROLE_PERMISSIONS_TTL_SECONDS = 60 * 60; // 1 hour, overridable via env

/**
 * Dynamic RBAC gate: runs after JwtAuthGuard has populated the auth context.
 * Requires ALL permissions declared via @RequirePermissions(...) to be
 * present on the caller's role. Role -> permissions lookups are cached in
 * Redis (Cache-Aside, 1h TTL) so authorization never becomes a hot path
 * against Postgres.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const auth = getAuthContext();
    if (!auth) {
      throw new AppException(
        ErrorCodes.UNAUTHORIZED,
        'Authentication is required before authorization can be evaluated.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const grantedPermissions = await this.resolveRolePermissions(auth.roleId);

    const missing = requiredPermissions.filter(
      (permission) => !grantedPermissions.includes(permission),
    );

    if (missing.length > 0) {
      throw new AppException(
        ErrorCodes.FORBIDDEN_RESOURCE,
        `Missing required permission(s): ${missing.join(', ')}.`,
        HttpStatus.FORBIDDEN,
        { missing },
      );
    }

    return true;
  }

  private async resolveRolePermissions(roleId: string): Promise<string[]> {
    const cacheKey = rolePermissionsCacheKey(roleId);
    const cached = await this.redis.get<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { action: true } } },
    });

    const permissions = rolePermissions.map((rp) => rp.permission.action);

    const ttl = this.configService.get<number>(
      'ROLE_PERMISSIONS_CACHE_TTL_SECONDS',
      ROLE_PERMISSIONS_TTL_SECONDS,
    );
    await this.redis.set(cacheKey, permissions, ttl);

    return permissions;
  }
}
