import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import ms from 'ms';
import { PrismaService } from '../../core/database/prisma.service.js';
import { Transactional } from '../../core/database/transactional.decorator.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { TokenPairResponseDto } from './dto/token-pair-response.dto.js';
import type { NormalizedOAuthProfile } from './interfaces/oauth-profile.interface.js';
import type { UserResponseDto } from '../users/dto/user-response.dto.js';

function toUserResponse(user: User, roleName: string): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    roleId: user.roleId,
    roleName,
  };
}

interface TokenSubject {
  id: string;
  username: string;
  roleId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  @Transactional()
  async generateTokens(user: TokenSubject): Promise<{ accessToken: string; refreshToken: string }> {
    await this.enforceMaxSessions(user.id);

    const jti = randomUUID();
    const accessToken = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      roleId: user.roleId,
      jti,
    });

    const recordId = randomUUID();
    const secret = randomBytes(64).toString('hex');
    const hashedToken = await argon2.hash(secret);

    const refreshTtlMs = ms(this.configService.get<string>('JWT_REFRESH_TOKEN_TTL', '7d') as any);
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    await this.prisma.tx.refreshToken.create({
      data: { id: recordId, userId: user.id, hashedToken, expiresAt },
    });

    return { accessToken, refreshToken: `${recordId}.${secret}` };
  }

  @Transactional()
  async registerLocal(dto: RegisterDto): Promise<TokenPairResponseDto> {
    const existing = await this.prisma.tx.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new AppException(
        ErrorCodes.USER_ALREADY_EXISTS,
        'A user with this email or username already exists.',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const role = await this.getOrCreateUserRole();

    const user = await this.prisma.tx.user.create({
      data: { email: dto.email, username: dto.username, passwordHash, roleId: role.id },
    });

    const tokens = await this.generateTokens({ id: user.id, username: user.username, roleId: user.roleId });
    return { ...tokens, user: toUserResponse(user, role.name) };
  }

  async loginLocal(dto: LoginDto): Promise<TokenPairResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
      include: { role: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppException(
        ErrorCodes.INVALID_CREDENTIALS,
        'Invalid email/username or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new AppException(
        ErrorCodes.INVALID_CREDENTIALS,
        'Invalid email/username or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokens = await this.generateTokens({ id: user.id, username: user.username, roleId: user.roleId });
    return { ...tokens, user: toUserResponse(user, user.role.name) };
  }

  @Transactional()
  async validateOAuthLogin(
    provider: string,
    profile: NormalizedOAuthProfile,
  ): Promise<TokenPairResponseDto> {
    const existingAccount = await this.prisma.tx.userAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
      include: { user: { include: { role: true } } },
    });

    let user: User;
    let roleName: string;

    if (existingAccount) {
      // Case A: known federated identity - sync mutable profile fields (role is untouched here).
      user = await this.prisma.tx.user.update({
        where: { id: existingAccount.userId },
        data: {
          avatarUrl: profile.avatarUrl ?? existingAccount.user.avatarUrl,
          displayName: profile.username,
        },
      });
      await this.prisma.tx.userAccount.update({
        where: { id: existingAccount.id },
        data: { profileData: profile.rawData as Prisma.InputJsonValue },
      });
      roleName = existingAccount.user.role.name;
    } else {
      const existingUser = await this.prisma.tx.user.findUnique({
        where: { email: profile.email },
        include: { role: true },
      });

      if (existingUser) {
        // Case B: same email already registered under another provider/password - link the new identity.
        user = existingUser;
        roleName = existingUser.role.name;
        await this.prisma.tx.userAccount.create({
          data: {
            userId: existingUser.id,
            provider,
            providerAccountId: profile.providerAccountId,
            profileData: profile.rawData as Prisma.InputJsonValue,
          },
        });
      } else {
        // Case C: brand new identity.
        const role = await this.getOrCreateUserRole();
        const username = await this.resolveUniqueUsername(profile.username);
        user = await this.prisma.tx.user.create({
          data: {
            email: profile.email,
            username,
            displayName: profile.username,
            avatarUrl: profile.avatarUrl,
            roleId: role.id,
          },
        });
        roleName = role.name;
        await this.prisma.tx.userAccount.create({
          data: {
            userId: user.id,
            provider,
            providerAccountId: profile.providerAccountId,
            profileData: profile.rawData as Prisma.InputJsonValue,
          },
        });
      }
    }

    const tokens = await this.generateTokens({ id: user.id, username: user.username, roleId: user.roleId });
    return { ...tokens, user: toUserResponse(user, roleName) };
  }

  @Transactional()
  async refreshTokens(rawToken: string): Promise<TokenPairResponseDto> {
    const [recordId, secret] = rawToken.split('.');

    if (!recordId || !secret) {
      throw new AppException(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'Refresh token is malformed.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const record = await this.prisma.tx.refreshToken.findUnique({
      where: { id: recordId },
      include: { user: { include: { role: true } } },
    });

    if (!record || record.isRevoked || record.expiresAt < new Date()) {
      throw new AppException(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'Refresh token is invalid, expired or already used.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenValid = await argon2.verify(record.hashedToken, secret);
    if (!tokenValid) {
      throw new AppException(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'Refresh token is invalid, expired or already used.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Rotation: this refresh token is single-use - revoke it before issuing the replacement.
    await this.prisma.tx.refreshToken.update({
      where: { id: record.id },
      data: { isRevoked: true },
    });

    const tokens = await this.generateTokens({
      id: record.user.id,
      username: record.user.username,
      roleId: record.user.roleId,
    });
    return { ...tokens, user: toUserResponse(record.user, record.user.role.name) };
  }

  @Transactional()
  async logout(userId: string, rawToken?: string): Promise<void> {
    if (!rawToken) {
      return;
    }

    const [recordId] = rawToken.split('.');
    if (!recordId) {
      return;
    }

    await this.prisma.tx.refreshToken.updateMany({
      where: { id: recordId, userId },
      data: { isRevoked: true },
    });
  }

  @Transactional()
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.tx.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  private async enforceMaxSessions(userId: string): Promise<void> {
    const maxSessions = this.configService.get<number>('MAX_ACTIVE_SESSIONS_PER_USER', 5);

    const activeSessions = await this.prisma.tx.refreshToken.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (activeSessions.length < maxSessions) {
      return;
    }

    const excess = activeSessions.length - maxSessions + 1;
    const idsToEvict = activeSessions.slice(0, excess).map((s) => s.id);

    await this.prisma.tx.refreshToken.updateMany({
      where: { id: { in: idsToEvict } },
      data: { isRevoked: true },
    });
  }

  private async getOrCreateUserRole() {
    const existing = await this.prisma.tx.role.findUnique({ where: { name: 'USER' } });
    if (existing) return existing;
    return this.prisma.tx.role.create({
      data: { name: 'USER', description: 'Standard authenticated end-user.' },
    });
  }

  /** Falls back to a randomized suffix if the OAuth display name collides with an existing username. */
  private async resolveUniqueUsername(base: string): Promise<string> {
    const sanitized = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'user';
    let candidate = sanitized;

    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await this.prisma.tx.user.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
      candidate = `${sanitized}_${randomBytes(2).toString('hex')}`;
    }

    return `${sanitized}_${randomUUID().slice(0, 8)}`;
  }
}
