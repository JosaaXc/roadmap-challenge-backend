import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'name must be an UPPER_SNAKE_CASE identifier (e.g. ADMIN, SUPPORT_AGENT).',
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
