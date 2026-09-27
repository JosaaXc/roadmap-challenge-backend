import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionResponseDto } from './permission-response.dto.js';

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ADMIN' })
  name!: string;

  @ApiPropertyOptional({ type: 'string', example: 'Full administrative access.', nullable: true })
  description!: string | null;

  @ApiProperty({
    type: [PermissionResponseDto],
    description: 'Permissions currently granted to this role.',
  })
  permissions!: PermissionResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
