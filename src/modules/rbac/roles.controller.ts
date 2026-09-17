import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { ApiEnvelopeError, ApiEnvelopePaginatedResponse, ApiEnvelopeResponse } from '../../common/swagger/index.js';
import { CursorPaginationDto } from '../../common/pagination/index.js';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RoleResponseDto } from './dto/role-response.dto.js';
import { RoleListItemResponseDto } from './dto/role-list-item-response.dto.js';

@ApiTags('RBAC - Roles')
@ApiBearerAuth()
@RequirePermissions('roles:manage')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({
    summary: 'List roles (cursor-paginated) with a lean permissions summary.',
    description: 'Permissions here carry only { id, action } - use GET /roles/:id for full detail.',
  })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max items (1-50, default 10).' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Last id from the previous page.' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Default desc.' })
  @ApiEnvelopePaginatedResponse(200, 'Roles retrieved successfully.', RoleListItemResponseDto)
  findAll(@Query() dto: CursorPaginationDto) {
    return this.rolesService.findAll(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single role by id.' })
  @ApiParam({ name: 'id', description: 'Role UUID.' })
  @ApiEnvelopeResponse(200, 'Role found.', RoleResponseDto)
  @ApiEnvelopeError(404, 'Role not found.', 'ROLE_NOT_FOUND')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new role.' })
  @ApiEnvelopeResponse(201, 'Role created.', RoleResponseDto)
  @ApiEnvelopeError(409, 'A role with this name already exists.', 'ROLE_ALREADY_EXISTS')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role (name and/or description).' })
  @ApiParam({ name: 'id', description: 'Role UUID.' })
  @ApiEnvelopeResponse(200, 'Role updated.', RoleResponseDto)
  @ApiEnvelopeError(404, 'Role not found.', 'ROLE_NOT_FOUND')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role.' })
  @ApiParam({ name: 'id', description: 'Role UUID.' })
  @ApiResponse({ status: 204, description: 'Role deleted (no response body).' })
  @ApiEnvelopeError(404, 'Role not found.', 'ROLE_NOT_FOUND')
  @ApiEnvelopeError(409, 'Role still has users assigned to it.', 'ROLE_HAS_ASSIGNED_USERS')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions/:permissionId')
  @ApiOperation({ summary: 'Grant a permission to a role.' })
  @ApiParam({ name: 'id', description: 'Role UUID.' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID.' })
  @ApiEnvelopeResponse(201, 'Permission granted; role returned with updated grants.', RoleResponseDto)
  @ApiEnvelopeError(404, 'Role not found.', 'ROLE_NOT_FOUND')
  @ApiEnvelopeError(404, 'Permission not found.', 'PERMISSION_NOT_FOUND')
  assignPermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.assignPermission(id, permissionId);
  }

  @Delete(':id/permissions/:permissionId')
  @ApiOperation({ summary: 'Revoke a permission from a role.' })
  @ApiParam({ name: 'id', description: 'Role UUID.' })
  @ApiParam({ name: 'permissionId', description: 'Permission UUID.' })
  @ApiEnvelopeResponse(200, 'Permission revoked; role returned with updated grants.', RoleResponseDto)
  @ApiEnvelopeError(404, 'Role not found.', 'ROLE_NOT_FOUND')
  @ApiEnvelopeError(404, 'Role does not have this permission assigned.', 'ROLE_PERMISSION_NOT_ASSIGNED')
  revokePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.revokePermission(id, permissionId);
  }
}
