import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'paths:create',
    description: "Permission action, following the '<resource>:<verb>' convention.",
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+:[a-z0-9-]+$/, {
    message: "action must follow the '<resource>:<verb>' convention (e.g. paths:create).",
  })
  action!: string;

  @ApiPropertyOptional({ example: 'Allows creating new learning paths.', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
