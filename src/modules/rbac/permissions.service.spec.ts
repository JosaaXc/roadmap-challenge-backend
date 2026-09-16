import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PermissionsService } from './permissions.service.js';
import { RbacCacheService } from './rbac-cache.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AppException } from '../../common/exceptions/app.exception.js';

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('mock', {
    code,
    clientVersion: 'test',
  });
}

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: {
    permission: Record<string, ReturnType<typeof vi.fn>>;
    rolePermission: Record<string, ReturnType<typeof vi.fn>>;
  };
  let rbacCache: { invalidateRoles: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      permission: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      rolePermission: { findMany: vi.fn() },
    };
    rbacCache = { invalidateRoles: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RbacCacheService, useValue: rbacCache },
      ],
    }).compile();

    service = module.get(PermissionsService);
  });

  describe('create', () => {
    it('creates a permission', async () => {
      prisma.permission.create.mockResolvedValue({ id: '1', action: 'paths:create' });

      const result = await service.create({ action: 'paths:create' });

      expect(result).toEqual({ id: '1', action: 'paths:create' });
    });

    it('throws a 409 AppException when the action already exists', async () => {
      prisma.permission.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.create({ action: 'paths:create' })).rejects.toThrow(AppException);
    });
  });

  describe('remove', () => {
    it('invalidates every role that had this permission granted', async () => {
      prisma.permission.findUnique.mockResolvedValue({ id: '1', action: 'paths:create' });
      prisma.rolePermission.findMany.mockResolvedValue([
        { roleId: 'role-a' },
        { roleId: 'role-b' },
      ]);
      prisma.permission.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');

      expect(prisma.permission.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(rbacCache.invalidateRoles).toHaveBeenCalledWith(['role-a', 'role-b']);
    });

    it('throws a 404 when the permission does not exist', async () => {
      prisma.permission.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(AppException);
    });
  });
});
