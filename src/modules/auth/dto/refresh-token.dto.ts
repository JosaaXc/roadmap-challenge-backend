import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Opaque refresh token issued at login/register/refresh.' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
