import { Controller, Get } from '@nestjs/common';
import { createPublicKey } from 'node:crypto';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import { JwtKeysService } from './keys/jwt-keys.service.js';

interface Jwk extends Record<string, unknown> {
  kid: string;
  alg: string;
  use: string;
}

@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwtKeysService: JwtKeysService) {}

  @IsPublic()
  @Get('jwks.json')
  getJwks(): { keys: Jwk[] } {
    const jwk = createPublicKey(this.jwtKeysService.getPublicKey()).export({
      format: 'jwk',
    }) as Record<string, unknown>;

    return {
      keys: [
        {
          ...jwk,
          kid: this.jwtKeysService.getKid(),
          alg: 'RS256',
          use: 'sig',
        },
      ],
    };
  }
}
