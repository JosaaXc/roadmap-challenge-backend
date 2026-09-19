import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Course } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { PaginatedResult, paginateWithCursor } from '../../common/pagination/index.js';
import type { CatalogQueryDto } from './dto/catalog-query.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) { }

  findAllCourses(dto: CatalogQueryDto): Promise<PaginatedResult<Course>> {
    const where: Prisma.CourseWhereInput = {};

    if (dto.level?.length) {
      where.level = { in: dto.level };
    }

    if (dto.tags?.length) {
      where.tags = { hasSome: dto.tags };
    }

    const search = dto.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    return paginateWithCursor<Course, Prisma.CourseFindManyArgs>(this.prisma.course, { where }, dto);
  }

  async findCourseBySlug(slug: string): Promise<Course> {
    const course = await this.prisma.course.findUnique({ where: { slug } });
    if (!course) {
      throw new AppException(ErrorCodes.COURSE_NOT_FOUND, `Course "${slug}" was not found.`, HttpStatus.NOT_FOUND);
    }
    return course;
  }
}
