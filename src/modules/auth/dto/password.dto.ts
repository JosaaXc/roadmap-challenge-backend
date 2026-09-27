import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';
import { IsStrongPassword } from './password-rules.js';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldStr0ng!Pass' })
  @IsString()
  currentPassword!: string;

  @IsStrongPassword('NewStr0ng!Pass')
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482913', description: 'Numeric OTP sent to the email.' })
  @IsString()
  @Matches(/^\d{4,10}$/, { message: 'otp must be a numeric code.' })
  otp!: string;

  @IsStrongPassword('NewStr0ng!Pass')
  newPassword!: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: true, description: 'Always true to prevent user enumeration.' })
  success!: true;
}
