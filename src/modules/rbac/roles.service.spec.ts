import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { RolesService } from './roles.service.js';
import { RbacCacheService } from './rbac-cache.service.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AppException } from '../../common/exceptions/app.exception.js';

function knownRequestError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('mock', {
    code,
    clientVersion: 'test',
  });
}

describe('RolesService', () => {
  let service: RolesService;
  let prisma: {
    role: Record<string, ReturnType<typeof vi.fn>>;
    rolePermission: Record<string, ReturnType<typeof vi.fn>>;
    permission: Record<string, ReturnType<typeof vi.fn>>;
  };
  let rbacCache: { invalidateRole: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      role: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      rolePermission: { upsert: vi.fn(), delete: vi.fn() },
      permission: { findUnique: vi.fn() },
    };
    rbacCache = { invalidateRole: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RbacCacheService, useValue: rbacCache },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  describe('create', () => {
    it('creates a role', async () => {
      prisma.role.create.mockResolvedValue({ id: '1', name: 'ADMIN' });

      const result = await service.create({ name: 'ADMIN' });

      expect(result).toEqual({ id: '1', name: 'ADMIN' });
      expect(prisma.role.create).toHaveBeenCalledWith({ data: { name: 'ADMIN' } });
    });

    it('throws a 409 AppException when the role name already exists', async () => {
      prisma.role.create.mockRejectedValue(knownRequestError('P2002'));

      await expect(service.create({ name: 'ADMIN' })).rejects.toThrow(AppException);
    });
  });

  describe('remove', () => {
    it('invalidates the role permissions cache after deleting', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: '1', name: 'ADMIN', permissions: [] });
      prisma.role.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');

      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(rbacCache.invalidateRole).toHaveBeenCalledWith('1');
    });

    it('rejects with a 409 when users still hold the role (FK violation)', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: '1', name: 'ADMIN', permissions: [] });
      prisma.role.delete.mockRejectedValue(knownRequestError('P2003'));

      await expect(service.remove('1')).rejects.toThrow(AppException);
      expect(rbacCache.invalidateRole).not.toHaveBeenCalled();
    });

    it('throws a 404 when the role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(AppException);
    });
  });

  describe('assignPermission', () => {
    it('links the permission and invalidates the cache', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: '1', name: 'ADMIN', permissions: [] });
      prisma.permission.findUnique.mockResolvedValue({ id: 'p1', action: 'roles:manage' });
      prisma.rolePermission.upsert.mockResolvedValue({});

      await service.assignPermission('1', 'p1');

      expect(prisma.rolePermission.upsert).toHaveBeenCalledWith({
        where: { roleId_permissionId: { roleId: '1', permissionId: 'p1' } },
        update: {},
        create: { roleId: '1', permissionId: 'p1' },
      });
      expect(rbacCache.invalidateRole).toHaveBeenCalledWith('1');
    });

    it('throws a 404 when the permission does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: '1', name: 'ADMIN', permissions: [] });
      prisma.permission.findUnique.mockResolvedValue(null);

      await expect(service.assignPermission('1', 'missing')).rejects.toThrow(AppException);
      expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
    });
  });
});
