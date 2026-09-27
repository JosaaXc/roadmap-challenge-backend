import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { createPublicKey } from 'node:crypto';
import { IsPublic } from '../../common/decorators/is-public.decorator.js';
import { SkipResponseEnvelope } from '../../common/decorators/skip-response-envelope.decorator.js';
import { SkipRequiredHeaders } from '../../common/decorators/skip-required-headers.decorator.js';
import { JwtKeysService } from './keys/jwt-keys.service.js';

interface Jwk extends Record<string, unknown> {
  kid: string;
  alg: string;
  use: string;
}

@ApiTags('Auth - JWKS')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwtKeysService: JwtKeysService) {}

  @IsPublic()
  @SkipResponseEnvelope()
  @SkipRequiredHeaders()
  @Get('jwks.json')
  @ApiOperation({
    summary: 'Public JSON Web Key Set (JWKS) for verifying RS256 access tokens.',
    description:
      'Unauthenticated, standard endpoint (RFC 7517) meant to be consumed by external ' +
      'verifiers (API gateways, other services) - not by the frontend to obtain a token. ' +
      'Returned as-is (NOT wrapped in the { success, data, meta } envelope) so standard ' +
      'JWKS clients can parse it directly.',
  })
  @ApiResponse({
    status: 200,
    description: 'JWK set containing the current signing public key (raw RFC 7517 shape).',
    schema: {
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string', example: 'RSA' },
              n: { type: 'string' },
              e: { type: 'string', example: 'AQAB' },
              kid: { type: 'string', example: 'codequest-default' },
              alg: { type: 'string', example: 'RS256' },
              use: { type: 'string', example: 'sig' },
            },
          },
        },
      },
    },
  })
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
