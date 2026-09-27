import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'jane_doe' })
  username!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'uuid' })
  roleId!: string;

  @ApiProperty({ example: 'USER' })
  roleName!: string;
}

export class LinkedAccountDto {
  @ApiProperty({ example: 'DISCORD' })
  provider!: string;

  @ApiProperty()
  providerAccountId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class UserProfileResponseDto extends UserResponseDto {
  @ApiProperty({ type: [LinkedAccountDto] })
  accounts!: LinkedAccountDto[];
}
