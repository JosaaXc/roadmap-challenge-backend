import { Injectable } from '@nestjs/common';
import { RedisService } from '../../core/cache/redis.service.js';
import { rolePermissionsCacheKey } from '../../common/cache/cache-keys.util.js';

/**
 * Keeps PermissionsGuard's Cache-Aside role_permissions:{roleId} entries
 * consistent with Postgres. Any write path that changes what a role can do
 * (assign/revoke a permission, delete a role or a permission) must call
 * this so the next request doesn't read a stale grant from Redis.
 */
@Injectable()
export class RbacCacheService {
  constructor(private readonly redis: RedisService) { }

  async invalidateRole(roleId: string): Promise<void> {
    await this.redis.del(rolePermissionsCacheKey(roleId));
  }

  async invalidateRoles(roleIds: string[]): Promise<void> {
    await Promise.all(roleIds.map((roleId) => this.invalidateRole(roleId)));
  }
}
