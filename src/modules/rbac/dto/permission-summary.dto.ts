import { ApiProperty } from '@nestjs/swagger';

/** Lightweight permission shape for list views - no description/timestamps. */
export class PermissionSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'paths:create' })
  action!: string;
}
