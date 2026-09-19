import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CursorPaginationDto } from '../../../common/pagination/index.js';

export class PathQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Filter by favorite flag.', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: 'Filter by public visibility.', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublic?: boolean;
}
