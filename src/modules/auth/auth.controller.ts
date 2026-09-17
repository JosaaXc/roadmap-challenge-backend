import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { SkipRequiredHeaders } from '../../common/decorators/skip-required-headers.decorator.js';
import { ApiEnvelopeError, ApiEnvelopeResponse } from '../../common/swagger/index.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { TokenPairResponseDto } from './dto/token-pair-response.dto.js';
import { DiscordAuthGuard } from './guards/discord-auth.guard.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @IsPublic()
  @Idempotent()
  @ApiOperation({
    summary: 'Register a new local (email/password) account.',
    description: 'Idempotent: retry safely with the same Idempotency-Key.',
  })
  @ApiEnvelopeResponse(201, 'Account created; tokens issued.', TokenPairResponseDto)
  @ApiEnvelopeError(409, 'A user with this email or username already exists.', 'USER_ALREADY_EXISTS')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.registerLocal(dto);
  }

  @Post('login')
  @IsPublic()
  @ApiOperation({ summary: 'Log in with email/password.' })
  @ApiEnvelopeResponse(200, 'Tokens issued.', TokenPairResponseDto)
  @ApiEnvelopeError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.loginLocal(dto);
  }

  @Post('refresh')
  @IsPublic()
  @ApiOperation({ summary: 'Exchange a refresh token for a new access/refresh pair (rotation).' })
  @ApiEnvelopeResponse(200, 'New tokens issued; the old refresh token is revoked.', TokenPairResponseDto)
  @ApiEnvelopeError(401, 'Refresh token is invalid, expired or already used.', 'INVALID_REFRESH_TOKEN')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Get('discord')
  @IsPublic()
  @SkipRequiredHeaders()
  @UseGuards(DiscordAuthGuard)
  @ApiOperation({ summary: 'Redirects to Discord for OAuth2 consent.' })
  discordLogin() {
    // Handled entirely by DiscordAuthGuard - it redirects to Discord before this ever runs.
  }

  @Get('discord/callback')
  @IsPublic()
  @SkipRequiredHeaders()
  @UseGuards(DiscordAuthGuard)
  @ApiOperation({
    summary: 'Discord OAuth2 callback.',
    description: 'Redirects to `${FRONTEND_URL}/auth/callback?token=...&refreshToken=...` with the issued tokens.',
  })
  discordCallback(@Req() req: Request, @Res() res: Response) {
    const { accessToken, refreshToken } = req.user as TokenPairResponseDto;
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const redirectUrl = `${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(redirectUrl);
  }
}
