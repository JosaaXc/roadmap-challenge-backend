import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class TokenPairResponseDto {
  @ApiProperty({ description: 'RS256-signed JWT access token (short-lived).' })
  accessToken!: string;

  @ApiProperty({ description: 'Opaque refresh token (long-lived, single-use - rotates on refresh).' })
  refreshToken!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
