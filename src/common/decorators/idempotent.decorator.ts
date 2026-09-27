import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  ttlSeconds?: number;
  /** Whether the Idempotency-Key header is mandatory for this route. Default true. */
  required?: boolean;
}

export const Idempotent = (options?: IdempotentOptions) =>
  SetMetadata(IDEMPOTENT_KEY, options ?? {});
