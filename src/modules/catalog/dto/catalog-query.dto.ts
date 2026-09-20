import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CursorPaginationDto } from '../../../common/pagination/index.js';
import { csvToArray, csvToUpperArray } from '../../../common/utils/index.js';

export const COURSE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export class CatalogQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by one or more levels (CSV).',
    example: 'BEGINNER,INTERMEDIATE',
  })
  @IsOptional()
  @Transform(({ value }) => csvToUpperArray(value))
  @IsIn(COURSE_LEVELS as unknown as string[], { each: true })
  level?: CourseLevel[];

  @ApiPropertyOptional({
    description: 'Filter by tags with OR semantics (CSV, case-insensitive).',
    example: 'node,docker',
  })
  @IsOptional()
  @Transform(({ value }) => csvToArray(value))
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Full-text search over title and description.',
    example: 'nest',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  search?: string;
}
