import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionSummaryDto } from './permission-summary.dto.js';

/** Lean role shape for list views - permissions carry only id/action. */
export class RoleListItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ADMIN' })
  name!: string;

  @ApiPropertyOptional({ type: 'string', example: 'Full administrative access.', nullable: true })
  description!: string | null;

  @ApiProperty({
    type: [PermissionSummaryDto],
    description: 'Permissions currently granted to this role (summary only - see GET /roles/:id for full detail).',
  })
  permissions!: PermissionSummaryDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
