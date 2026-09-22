import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppException } from '../../../common/exceptions/app.exception.js';
import { ErrorCodes } from '../../../common/exceptions/error-codes.enum.js';
import { HttpStatus } from '@nestjs/common';
import { JwtKeysService } from '../keys/jwt-keys.service.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    jwtKeysService: JwtKeysService,
    _configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtKeysService.getPublicKey(),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload?.sub || !payload.username || !payload.roleId) {
      throw new AppException(
        ErrorCodes.INVALID_TOKEN,
        'Token payload is missing required claims (sub, username, roleId).',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return payload;
  }
}
