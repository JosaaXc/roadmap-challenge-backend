export const sessionCacheKey = (userId: string, jti: string): string =>
  `session:${userId}:${jti}`;

export const rolePermissionsCacheKey = (roleId: string): string =>
  `role_permissions:${roleId}`;
