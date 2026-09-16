import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { RbacCacheService } from './rbac-cache.service.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import type { UpdateRoleDto } from './dto/update-role.dto.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacCache: RbacCacheService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new AppException(
        ErrorCodes.VALIDATION_ERROR,
        `Role "${id}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return role;
  }

  async create(dto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({ data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppException(
          ErrorCodes.VALIDATION_ERROR,
          `Role "${dto.name}" already exists.`,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  /** Blocked at the DB level (FK) if users still hold this role - surfaced as a clear 409. */
  async remove(id: string): Promise<void> {
    await this.findOne(id);

    try {
      await this.prisma.role.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new AppException(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot delete a role that still has users assigned to it.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }

    await this.rbacCache.invalidateRole(id);
  }

  async assignPermission(roleId: string, permissionId: string) {
    await this.findOne(roleId);
    await this.ensurePermissionExists(permissionId);

    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });

    await this.rbacCache.invalidateRole(roleId);
    return this.findOne(roleId);
  }

  async revokePermission(roleId: string, permissionId: string) {
    await this.findOne(roleId);

    await this.prisma.rolePermission
      .delete({ where: { roleId_permissionId: { roleId, permissionId } } })
      .catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new AppException(
            ErrorCodes.VALIDATION_ERROR,
            `Role "${roleId}" does not have permission "${permissionId}" assigned.`,
            HttpStatus.NOT_FOUND,
          );
        }
        throw err;
      });

    await this.rbacCache.invalidateRole(roleId);
    return this.findOne(roleId);
  }

  private async ensurePermissionExists(permissionId: string): Promise<void> {
    const exists = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!exists) {
      throw new AppException(
        ErrorCodes.VALIDATION_ERROR,
        `Permission "${permissionId}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
