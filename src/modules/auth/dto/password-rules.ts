import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Single source of truth for password strength, shared by
 * RegisterDto / ChangePasswordDto / ResetPasswordDto.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/;
export const PASSWORD_PATTERN_MESSAGE =
  'password must contain at least one uppercase letter, one lowercase letter, one number and one special character.';
export const PASSWORD_DESCRIPTION =
  'At least 8 chars, one uppercase, one lowercase, one number and one special character.';

export function IsStrongPassword(example = 'Str0ng!Passw0rd') {
  return applyDecorators(
    ApiProperty({
      example,
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
      description: PASSWORD_DESCRIPTION,
    }),
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    MaxLength(PASSWORD_MAX_LENGTH),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE }),
  );
}
