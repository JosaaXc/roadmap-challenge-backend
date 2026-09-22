import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { JwksController } from './jwks.controller.js';
import { JwtKeysModule } from './keys/jwt-keys.module.js';
import { JwtKeysService } from './keys/jwt-keys.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { DiscordStrategy } from './strategies/discord.strategy.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { DiscordCallbackGuard } from './guards/discord-callback.guard.js';

@Module({
  imports: [
    PassportModule,
    JwtKeysModule,
    JwtModule.registerAsync({
      imports: [ConfigModule, JwtKeysModule],
      inject: [JwtKeysService, ConfigService],
      useFactory: (
        jwtKeysService: JwtKeysService,
        configService: ConfigService,
      ): JwtModuleOptions => ({
        privateKey: jwtKeysService.getPrivateKey(),
        publicKey: jwtKeysService.getPublicKey(),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: configService.get<string>(
            'JWT_ACCESS_TOKEN_TTL',
            '15m',
          ) as StringValue,
          keyid: jwtKeysService.getKid(),
        },
        verifyOptions: {
          algorithms: ['RS256'],
        },
      }),
    }),
  ],
  controllers: [JwksController, AuthController],
  providers: [JwtKeysService, JwtStrategy, DiscordStrategy, AuthService, DiscordCallbackGuard],
  exports: [JwtModule, JwtKeysService, AuthService],
})
export class AuthModule { }
