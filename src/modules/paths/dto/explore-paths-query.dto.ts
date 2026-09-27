import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CursorPaginationDto } from '../../../common/pagination/index.js';

export type ExploreSort = 'popular' | 'recent';

export class ExplorePathsQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    enum: ['popular', 'recent'],
    default: 'popular',
    description: 'popular: likesCount desc. recent: createdAt desc. Direction is always desc by feed design (the inherited order param is ignored).',
  })
  @IsOptional()
  @IsIn(['popular', 'recent'])
  sortBy?: ExploreSort = 'popular';

  @ApiPropertyOptional({ description: 'Search in title and description (min 2 chars).', example: 'nestjs' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;
}
