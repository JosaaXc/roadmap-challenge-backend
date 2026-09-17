import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-discord';
import { AuthService } from '../auth.service.js';
import type { TokenPairResponseDto } from '../dto/token-pair-response.dto.js';

function discordAvatarUrl(profile: Profile): string | undefined {
  if (!profile.avatar) return undefined;
  const extension = profile.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${extension}`;
}

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('DISCORD_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('DISCORD_CALLBACK_URL'),
      scope: ['identify', 'email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<TokenPairResponseDto> {
    return this.authService.validateOAuthLogin('DISCORD', {
      providerAccountId: profile.id,
      email: profile.email ?? `${profile.id}@discord.local`,
      username: profile.username,
      avatarUrl: discordAvatarUrl(profile),
      rawData: profile,
    });
  }
}
