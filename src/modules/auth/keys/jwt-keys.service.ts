import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Holds the RS256 asymmetric key pair used to sign (private) and verify /
 * JWKS (public) access tokens.
 *
 * Keys travel as base64-encoded PEM content directly in JWT_PRIVATE_KEY /
 * JWT_PUBLIC_KEY env vars (not file paths) so the same config works
 * unchanged across local dev, CI and containers/Windows, with no shared
 * filesystem or OpenSSL dependency. Generate a pair with:
 *   npm run generate:jwt-keys
 */
@Injectable()
export class JwtKeysService {
  private readonly logger = new Logger('JWT_KEYS');
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly kid: string;

  constructor(private readonly configService: ConfigService) {
    this.privateKey = this.decode(
      this.configService.getOrThrow<string>('JWT_PRIVATE_KEY'),
      'JWT_PRIVATE_KEY',
    );
    this.publicKey = this.decode(
      this.configService.getOrThrow<string>('JWT_PUBLIC_KEY'),
      'JWT_PUBLIC_KEY',
    );
    this.kid = this.configService.get<string>('JWT_KID', 'codequest-default');

    this.logger.log(`RS256 key pair loaded (kid=${this.kid}).`);
  }

  private decode(base64: string, varName: string): string {
    const pem = Buffer.from(base64, 'base64').toString('utf8');
    if (!pem.includes('-----BEGIN')) {
      throw new Error(
        `[JWT_KEYS] ${varName} does not look like a base64-encoded PEM key. ` +
        'Regenerate it with "npm run generate:jwt-keys".',
      );
    }
    return pem;
  }

  getPrivateKey(): string {
    return this.privateKey;
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  getKid(): string {
    return this.kid;
  }
}
