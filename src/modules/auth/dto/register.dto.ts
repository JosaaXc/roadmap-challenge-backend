import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'jane_doe', minLength: 3, maxLength: 32 })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers and underscores.',
  })
  username!: string;

  @ApiProperty({
    example: 'Str0ng!Passw0rd',
    minLength: 8,
    maxLength: 128,
    description: 'At least 8 chars, one uppercase, one lowercase, one number and one special character.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, one number and one special character.',
  })
  password!: string;
}
