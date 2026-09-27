import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Course } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service.js';
import { RedisService } from '../../core/cache/redis.service.js';
import { catalogTagsCacheKey } from '../../common/cache/cache-keys.util.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { Transactional } from '../../core/database/transactional.decorator.js';
import { PaginatedResult, paginateWithCursor } from '../../common/pagination/index.js';
import type { CatalogQueryDto } from './dto/catalog-query.dto.js';
import type { CreateCourseDto, UpdateCourseDto } from './dto/create-course.dto.js';

const TAGS_CACHE_TTL_SECONDS = 3600; // 1h

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  async getExistingTags(): Promise<string[]> {
    const key = catalogTagsCacheKey();
    const cached = await this.redis.get<string[]>(key);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<Array<{ tag: string }>>`
      SELECT DISTINCT unnest(tags) AS tag
      FROM courses
      WHERE "deletedAt" IS NULL AND "isActive" = TRUE
      UNION
      SELECT DISTINCT unnest(o."tagsOutput") AS tag
      FROM question_options o
      JOIN questions q ON q.id = o."questionId"
      WHERE q."isActive" = TRUE
    `;

    const tags = [...new Set(rows.map((row) => row.tag.toLowerCase()))].sort((a, b) =>
      a.localeCompare(b),
    );
    await this.redis.set(key, tags, TAGS_CACHE_TTL_SECONDS);
    return tags;
  }

  findAllCourses(dto: CatalogQueryDto): Promise<PaginatedResult<Course>> {
    const where: Prisma.CourseWhereInput = { isActive: true };

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
    const course = await this.prisma.course.findFirst({ where: { slug, isActive: true } });
    if (!course) {
      throw new AppException(ErrorCodes.COURSE_NOT_FOUND, `Course "${slug}" was not found.`, HttpStatus.NOT_FOUND);
    }
    return course;
  }

  @Transactional()
  async createCourse(dto: CreateCourseDto): Promise<Course> {
    const tx = this.prisma.tx;
    const existing = await tx.course.findFirst({ where: { slug: dto.slug } });
    if (existing) {
      throw new AppException(
        ErrorCodes.SLUG_ALREADY_EXISTS,
        `Course with slug "${dto.slug}" already exists.`,
        HttpStatus.CONFLICT,
      );
    }
    const created = await tx.course.create({ data: dto });
    await this.redis.del(catalogTagsCacheKey());
    return created;
  }

  @Transactional()
  async updateCourse(
    id: string,
    dto: UpdateCourseDto,
  ): Promise<Course> {
    const tx = this.prisma.tx;
    const course = await tx.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppException(
        ErrorCodes.COURSE_NOT_FOUND,
        `Course "${id}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    if (dto.slug && dto.slug !== course.slug) {
      const existing = await tx.course.findFirst({ where: { slug: dto.slug } });
      if (existing) {
        throw new AppException(
          ErrorCodes.SLUG_ALREADY_EXISTS,
          `Course with slug "${dto.slug}" already exists.`,
          HttpStatus.CONFLICT,
        );
      }
    }
    const updated = await tx.course.update({ where: { id }, data: dto });
    await this.redis.del(catalogTagsCacheKey());
    return updated;
  }

  @Transactional()
  async deleteCourse(id: string): Promise<void> {
    const tx = this.prisma.tx;
    const course = await tx.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppException(
        ErrorCodes.COURSE_NOT_FOUND,
        `Course "${id}" was not found.`,
        HttpStatus.NOT_FOUND,
      );
    }
    await tx.course.delete({ where: { id } });
    await this.redis.del(catalogTagsCacheKey());
  }
}
