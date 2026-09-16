import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+:[a-z0-9-]+$/, {
    message: "action must follow the '<resource>:<verb>' convention (e.g. paths:create).",
  })
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
