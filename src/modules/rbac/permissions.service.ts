import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Permission } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { CursorPaginationDto, PaginatedResult, paginateWithCursor } from '../../common/pagination/index.js';
import { RbacCacheService } from './rbac-cache.service.js';
import type { CreatePermissionDto } from './dto/create-permission.dto.js';
import type { UpdatePermissionDto } from './dto/update-permission.dto.js';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacCache: RbacCacheService,
  ) { }

  findAll(dto: CursorPaginationDto): Promise<PaginatedResult<Permission>> {
    return paginateWithCursor<Permission, Prisma.PermissionFindManyArgs>(
      this.prisma.permission,
      {},
      dto,
    );
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findUnique({ where: { id } });
    if (!permission) {
      throw new AppException(
        ErrorCodes.PERMISSION_NOT_FOUND,
        `Permission "${id}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return permission;
  }

  async create(dto: CreatePermissionDto) {
    try {
      return await this.prisma.permission.create({ data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppException(
          ErrorCodes.PERMISSION_ALREADY_EXISTS,
          `Permission action "${dto.action}" already exists.`,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdatePermissionDto) {
    await this.findOne(id);
    return this.prisma.permission.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const affectedRoles = await this.prisma.rolePermission.findMany({
      where: { permissionId: id },
      select: { roleId: true },
    });

    await this.prisma.permission.delete({ where: { id } });
    await this.rbacCache.invalidateRoles(affectedRoles.map((r) => r.roleId));
  }
}
