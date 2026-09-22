import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import ms from 'ms';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { SkipRequiredHeaders } from '../../common/decorators/skip-required-headers.decorator.js';
import { ApiEnvelopeError, ApiEnvelopeResponse } from '../../common/swagger/index.js';
import { getAuthContext } from '../../common/middlewares/tracing.context.js';
import { AppException } from '../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../common/exceptions/error-codes.enum.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LogoutResponseDto } from './dto/logout-response.dto.js';
import { TokenPairResponseDto } from './dto/token-pair-response.dto.js';
import { DiscordAuthGuard } from './guards/discord-auth.guard.js';
import { DiscordCallbackGuard } from './guards/discord-callback.guard.js';

const REFRESH_TOKEN_COOKIE = 'refreshToken';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  @Post('register')
  @IsPublic()
  @Idempotent()
  @ApiOperation({
    summary: 'Register a new local (email/password) account.',
    description:
      'Idempotent: retry safely with the same Idempotency-Key. The refresh token is issued as an httpOnly cookie, not in the response body.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated unique key for this operation.' })
  @ApiEnvelopeResponse(201, 'Account created; access token issued.', AuthResponseDto)
  @ApiEnvelopeError(400, 'Missing Idempotency-Key header.', 'MISSING_IDEMPOTENCY_KEY')
  @ApiEnvelopeError(409, 'A user with this email or username already exists.', 'USER_ALREADY_EXISTS')
  @ApiEnvelopeError(409, 'A request with this Idempotency-Key is already in progress.', 'IDEMPOTENT_REQUEST_IN_PROGRESS')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const tokens = await this.authService.registerLocal(dto);
    return this.issueSession(res, tokens);
  }

  @Post('login')
  @IsPublic()
  @ApiOperation({
    summary: 'Log in with email/password.',
    description: 'The refresh token is issued as an httpOnly cookie, not in the response body.',
  })
  @ApiEnvelopeResponse(200, 'Access token issued.', AuthResponseDto)
  @ApiEnvelopeError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const tokens = await this.authService.loginLocal(dto);
    return this.issueSession(res, tokens);
  }

  @Post('refresh')
  @IsPublic()
  @ApiCookieAuth('refreshToken')
  @ApiOperation({
    summary: 'Exchange the refresh token cookie for a new access/refresh pair (rotation).',
    description:
      'No body. The refresh token travels ONLY as the httpOnly `refreshToken` cookie set by /login, /register or /discord/callback - send the request with credentials/cookies included. The rotated refresh token is written back the same way.',
  })
  @ApiEnvelopeResponse(200, 'New access token issued; the old refresh token is revoked.', AuthResponseDto)
  @ApiEnvelopeError(401, 'Refresh token is missing, invalid, expired or already used.', 'INVALID_REFRESH_TOKEN')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!rawToken) {
      throw new AppException(
        ErrorCodes.INVALID_REFRESH_TOKEN,
        'Refresh token is invalid, expired or already used.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokens = await this.authService.refreshTokens(rawToken);
    return this.issueSession(res, tokens);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiCookieAuth('refreshToken')
  @ApiOperation({
    summary: 'Log out the current session.',
    description:
      'Revokes the refresh token in the httpOnly `refreshToken` cookie and clears it. Idempotent: succeeds with 200 even when the cookie is missing or already revoked. The access JWT remains valid until its exp (max 15m) - standard stateless behavior.',
  })
  @ApiEnvelopeResponse(200, 'Current session closed.', LogoutResponseDto)
  @ApiEnvelopeError(401, 'Access token is missing, malformed, expired or invalid.', 'INVALID_TOKEN')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LogoutResponseDto> {
    const auth = getAuthContext();
    if (!auth) {
      throw new AppException(ErrorCodes.UNAUTHORIZED, 'Authentication context is missing.', HttpStatus.UNAUTHORIZED);
    }

    await this.authService.logout(auth.userId, req.cookies?.[REFRESH_TOKEN_COOKIE]);
    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully.' };
  }

  @Post('logout/all')
  @ApiBearerAuth()
  @ApiCookieAuth('refreshToken')
  @ApiOperation({
    summary: 'Log out all sessions (every device/browser).',
    description:
      'Revokes every active refresh token of the authenticated user and clears the current cookie. Use after password change or suspected compromise. Idempotent: succeeds with 200 even when no sessions remain. Access JWTs remain valid until their exp (max 15m).',
  })
  @ApiEnvelopeResponse(200, 'All sessions closed.', LogoutResponseDto)
  @ApiEnvelopeError(401, 'Access token is missing, malformed, expired or invalid.', 'INVALID_TOKEN')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Res({ passthrough: true }) res: Response): Promise<LogoutResponseDto> {
    const auth = getAuthContext();
    if (!auth) {
      throw new AppException(ErrorCodes.UNAUTHORIZED, 'Authentication context is missing.', HttpStatus.UNAUTHORIZED);
    }

    await this.authService.logoutAll(auth.userId);
    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out from all sessions successfully.' };
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
  @UseGuards(DiscordCallbackGuard)
  @ApiOperation({
    summary: 'Discord OAuth2 callback.',
    description:
      'On success sets the refresh token as an httpOnly cookie, then redirects to `${FRONTEND_URL}/auth/callback?token=...` with the access token. ' +
      'On denial/failure (e.g. user pressed Cancel on Discord) redirects to `${FRONTEND_URL}/auth/callback?error=access_denied&error_description=...` so the SPA can render the denial UX.',
  })
  discordCallback(@Req() req: Request, @Res() res: Response) {
    // Guard already redirected on failure — nothing left to do.
    if (!req.user) return;
    const { accessToken, refreshToken } = req.user as TokenPairResponseDto;
    this.setRefreshTokenCookie(res, refreshToken);

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const redirectUrl = `${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`;
    res.redirect(redirectUrl);
  }

  private issueSession(res: Response, tokens: TokenPairResponseDto): AuthResponseDto {
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user: tokens.user };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const refreshTtlMs = ms(this.configService.get<string>('JWT_REFRESH_TOKEN_TTL', '7d') as any);

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.getRefreshTokenCookieBaseOptions(),
      maxAge: refreshTtlMs as unknown as number,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    // Must mirror path/domain/sameSite/secure of setRefreshTokenCookie or the browser keeps the cookie.
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.getRefreshTokenCookieBaseOptions());
  }

  private getRefreshTokenCookieBaseOptions(): CookieOptions {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      domain: this.configService.get<string>('COOKIE_DOMAIN'),
      path: '/api/v1/auth',
    };
  }
}
