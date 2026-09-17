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
import {
  ApiEnvelopeError,
  ApiEnvelopePaginatedResponse,
  ApiEnvelopeResponse,
} from '../../common/swagger/index.js';
import { CursorPaginationDto } from '../../common/pagination/index.js';
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
  @ApiOperation({ summary: 'List permissions (cursor-paginated).' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max items (1-50, default 10).' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Last id from the previous page.' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Default desc.' })
  @ApiEnvelopePaginatedResponse(200, 'Permissions retrieved successfully.', PermissionResponseDto)
  findAll(@Query() dto: CursorPaginationDto) {
    return this.permissionsService.findAll(dto);
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
