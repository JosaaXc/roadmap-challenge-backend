import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Human-readable confirmation of the logout operation.',
    example: 'Logged out successfully.',
  })
  message!: string;
}
