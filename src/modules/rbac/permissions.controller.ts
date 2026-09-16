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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { ApiEnvelopeError, ApiEnvelopeResponse } from '../../common/swagger/index.js';
import { PermissionsService } from './permissions.service.js';
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { UpdatePermissionDto } from './dto/update-permission.dto.js';
import { PermissionResponseDto } from './dto/permission-response.dto.js';

@ApiTags('RBAC - Permissions')
@ApiBearerAuth()
@RequirePermissions('permissions:manage')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all permissions.' })
  @ApiEnvelopeResponse(200, 'Permissions retrieved successfully.', PermissionResponseDto, {
    isArray: true,
  })
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single permission by id.' })
  @ApiParam({ name: 'id', description: 'Permission UUID.' })
  @ApiEnvelopeResponse(200, 'Permission found.', PermissionResponseDto)
  @ApiEnvelopeError(404, 'Permission not found.', 'PERMISSION_NOT_FOUND')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new permission (action, e.g. 'paths:create')." })
  @ApiEnvelopeResponse(201, 'Permission created.', PermissionResponseDto)
  @ApiEnvelopeError(409, 'A permission with this action already exists.', 'PERMISSION_ALREADY_EXISTS')
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update a permission's description." })
  @ApiParam({ name: 'id', description: 'Permission UUID.' })
  @ApiEnvelopeResponse(200, 'Permission updated.', PermissionResponseDto)
  @ApiEnvelopeError(404, 'Permission not found.', 'PERMISSION_NOT_FOUND')
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a permission (revokes it from every role that had it granted).' })
  @ApiParam({ name: 'id', description: 'Permission UUID.' })
  @ApiResponse({ status: 204, description: 'Permission deleted (no response body).' })
  @ApiEnvelopeError(404, 'Permission not found.', 'PERMISSION_NOT_FOUND')
  remove(@Param('id') id: string) {
    return this.permissionsService.remove(id);
  }
}
