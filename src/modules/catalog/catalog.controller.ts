import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import {
  ApiEnvelopeError,
  ApiEnvelopePaginatedResponse,
  ApiEnvelopeResponse,
} from '../../common/swagger/index.js';
import { CatalogService } from './catalog.service.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CourseResponseDto } from './dto/course-response.dto.js';
import { CreateCourseDto, UpdateCourseDto } from './dto/create-course.dto.js';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) { }

  @Get('courses')
  @IsPublic()
  @ApiOperation({ summary: 'List DevTalles courses (cursor-paginated, filterable).' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Max items (1-50, default 10).' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Last id from the previous page.' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], description: 'Cursor order (default desc).' })
  @ApiQuery({ name: 'level', required: false, type: String, description: 'CSV levels, e.g. BEGINNER,INTERMEDIATE.' })
  @ApiQuery({ name: 'tags', required: false, type: String, description: 'CSV tags with OR semantics, e.g. node,docker.' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in title and description (min 2 chars).' })
  @ApiEnvelopePaginatedResponse(200, 'Courses retrieved successfully.', CourseResponseDto)
  findAllCourses(@Query() dto: CatalogQueryDto) {
    return this.catalogService.findAllCourses(dto);
  }

  @Get('courses/:slug')
  @IsPublic()
  @ApiOperation({ summary: 'Get a single course by slug.' })
  @ApiParam({ name: 'slug', description: 'Course slug, e.g. nest-cero-experto.' })
  @ApiEnvelopeResponse(200, 'Course found.', CourseResponseDto)
  @ApiEnvelopeError(404, 'Course not found.', 'COURSE_NOT_FOUND')
  findCourseBySlug(@Param('slug') slug: string) {
    return this.catalogService.findCourseBySlug(slug);
  }

  @Post('courses')
  @RequirePermissions('catalog:create')
  @Idempotent()
  @ApiTags('Admin - Catalog')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new course (Admin only).' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique idempotency key for this request.' })
  @ApiEnvelopeResponse(201, 'Course created successfully.', CourseResponseDto)
  @ApiEnvelopeError(401, 'Unauthorized or missing token.', 'INVALID_TOKEN')
  @ApiEnvelopeError(403, 'Forbidden. Requires catalog:create permission.', 'FORBIDDEN_RESOURCE')
  @ApiEnvelopeError(409, 'Course slug already exists.', 'SLUG_ALREADY_EXISTS')
  createCourse(@Body() dto: CreateCourseDto) {
    return this.catalogService.createCourse(dto);
  }

  @Patch('courses/:id')
  @RequirePermissions('catalog:update')
  @ApiTags('Admin - Catalog')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing course (Admin only).' })
  @ApiParam({ name: 'id', description: 'Course UUID.' })
  @ApiEnvelopeResponse(200, 'Course updated successfully.', CourseResponseDto)
  @ApiEnvelopeError(401, 'Unauthorized or missing token.', 'INVALID_TOKEN')
  @ApiEnvelopeError(403, 'Forbidden. Requires catalog:update permission.', 'FORBIDDEN_RESOURCE')
  @ApiEnvelopeError(404, 'Course not found.', 'COURSE_NOT_FOUND')
  @ApiEnvelopeError(409, 'Course slug already exists.', 'SLUG_ALREADY_EXISTS')
  updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.catalogService.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('catalog:delete')
  @ApiTags('Admin - Catalog')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete a course (Admin only).' })
  @ApiParam({ name: 'id', description: 'Course UUID.' })
  @ApiEnvelopeResponse(204, 'Course deleted successfully.')
  @ApiEnvelopeError(401, 'Unauthorized or missing token.', 'INVALID_TOKEN')
  @ApiEnvelopeError(403, 'Forbidden. Requires catalog:delete permission.', 'FORBIDDEN_RESOURCE')
  @ApiEnvelopeError(404, 'Course not found.', 'COURSE_NOT_FOUND')
  deleteCourse(@Param('id') id: string) {
    return this.catalogService.deleteCourse(id);
  }
}
