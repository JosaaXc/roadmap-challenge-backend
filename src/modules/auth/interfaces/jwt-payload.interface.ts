export interface JwtPayload {
  sub: string;
  username: string;
  roleId: string;
  /** JWT ID - unique per issued token, used as the Redis session cache key. */
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  roleId: string;
}
