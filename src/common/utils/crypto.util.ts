import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex digests. Hashing both sides to
 * fixed-length buffers first ensures neither value nor length leaks
 * through timing. Returns false (instead of throwing) on length
 * mismatch so callers stay branch-simple.
 */
export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
