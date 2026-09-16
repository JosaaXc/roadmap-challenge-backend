import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Role, Permission } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { RbacCacheService } from './rbac-cache.service.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import type { UpdateRoleDto } from './dto/update-role.dto.js';
import type { RoleResponseDto } from './dto/role-response.dto.js';

type RoleWithPermissions = Role & {
  permissions: { permission: Permission }[];
};

/** Flattens the RolePermission join rows into a plain permissions[] the API surfaces. */
function toRoleResponse(role: RoleWithPermissions): RoleResponseDto {
  const { permissions, ...rest } = role;
  return { ...rest, permissions: permissions.map((rp) => rp.permission) };
}

const ROLE_WITH_PERMISSIONS_INCLUDE = {
  permissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacCache: RbacCacheService,
  ) {}

  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });
    return roles.map(toRoleResponse);
  }

  async findOne(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });
    if (!role) {
      throw new AppException(
        ErrorCodes.ROLE_NOT_FOUND,
        `Role "${id}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return toRoleResponse(role);
  }

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    try {
      const role = await this.prisma.role.create({ data: dto });
      return { ...role, permissions: [] };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppException(
          ErrorCodes.ROLE_ALREADY_EXISTS,
          `Role "${dto.name}" already exists.`,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    await this.findOne(id);
    await this.prisma.role.update({ where: { id }, data: dto });
    return this.findOne(id);
  }

  /** Blocked at the DB level (FK) if users still hold this role - surfaced as a clear 409. */
  async remove(id: string): Promise<void> {
    await this.findOne(id);

    try {
      await this.prisma.role.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new AppException(
          ErrorCodes.ROLE_HAS_ASSIGNED_USERS,
          'Cannot delete a role that still has users assigned to it.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }

    await this.rbacCache.invalidateRole(id);
  }

  async assignPermission(roleId: string, permissionId: string): Promise<RoleResponseDto> {
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

  async revokePermission(roleId: string, permissionId: string): Promise<RoleResponseDto> {
    await this.findOne(roleId);

    await this.prisma.rolePermission
      .delete({ where: { roleId_permissionId: { roleId, permissionId } } })
      .catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new AppException(
            ErrorCodes.ROLE_PERMISSION_NOT_ASSIGNED,
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
        ErrorCodes.PERMISSION_NOT_FOUND,
        `Permission "${permissionId}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
