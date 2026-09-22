import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsService } from './permissions.service.js';
import { RbacCacheService } from './rbac-cache.service.js';

@Module({
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsService, RbacCacheService],
  exports: [RolesService, PermissionsService, RbacCacheService],
})
export class RbacModule {}
