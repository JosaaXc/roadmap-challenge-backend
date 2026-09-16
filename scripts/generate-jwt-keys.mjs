// Cross-platform (Windows/macOS/Linux) RS256 key pair generator for JWT signing.
// Uses Node's native `crypto` - no OpenSSL binary required.
//
// Usage:
//   npm run generate:jwt-keys

import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const privateKeyB64 = Buffer.from(privateKey).toString('base64');
const publicKeyB64 = Buffer.from(publicKey).toString('base64');

console.log('# Paste these lines into your .env (they replace any existing JWT_PRIVATE_KEY / JWT_PUBLIC_KEY):');
console.log(`JWT_PRIVATE_KEY=${privateKeyB64}`);
console.log(`JWT_PUBLIC_KEY=${publicKeyB64}`);
