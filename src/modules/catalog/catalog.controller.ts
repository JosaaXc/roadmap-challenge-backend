import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import {
  ApiEnvelopeError,
  ApiEnvelopePaginatedResponse,
  ApiEnvelopeResponse,
} from '../../common/swagger/index.js';
import { CatalogService } from './catalog.service.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CourseResponseDto } from './dto/course-response.dto.js';

@ApiTags('Catalog')
@IsPublic()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) { }

  @Get('courses')
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
  @ApiOperation({ summary: 'Get a single course by slug.' })
  @ApiParam({ name: 'slug', description: 'Course slug, e.g. nest-cero-experto.' })
  @ApiEnvelopeResponse(200, 'Course found.', CourseResponseDto)
  @ApiEnvelopeError(404, 'Course not found.', 'COURSE_NOT_FOUND')
  findCourseBySlug(@Param('slug') slug: string) {
    return this.catalogService.findCourseBySlug(slug);
  }
}
