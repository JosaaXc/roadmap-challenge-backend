import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import type { UserProfileResponseDto } from './dto/user-response.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, accounts: true },
    });

    if (!user) {
      throw new AppException(
        ErrorCodes.USER_NOT_FOUND,
        'The authenticated user no longer exists.',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      roleId: user.roleId,
      roleName: user.role.name,
      accounts: user.accounts.map((account) => ({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        createdAt: account.createdAt,
      })),
    };
  }
}
