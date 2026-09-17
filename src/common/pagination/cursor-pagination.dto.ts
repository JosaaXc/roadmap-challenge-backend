import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type CursorOrder = 'asc' | 'desc';

export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Max number of items to return (1-50).',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  take?: number = 10;

  @ApiPropertyOptional({
    description: 'Opaque cursor - the id of the last item from the previous page.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: CursorOrder = 'desc';
}
