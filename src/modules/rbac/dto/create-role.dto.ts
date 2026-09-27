import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    example: 'SUPPORT_AGENT',
    description: 'UPPER_SNAKE_CASE role identifier.',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'name must be an UPPER_SNAKE_CASE identifier (e.g. ADMIN, SUPPORT_AGENT).',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'Handles support tickets.', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
