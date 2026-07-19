import crypto from 'node:crypto';

import { env } from '@/lib/env';

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1';

function key(): Buffer {
  const raw = env.TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set — required to store Gmail tokens (Phase 2).',
    );
  }

  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters).');
  }

  return buf;
}

/**
 * Encrypts a secret for storage. Output is `v1.<iv>.<tag>.<ciphertext>`, all
 * base64url — the version prefix lets `decryptSecret` tell an encrypted value
 * from a legacy plaintext one, and GCM's auth tag makes tampering detectable.
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptSecret(value: string): string {
  const parts = value.split('.');

  // A value that isn't in our format is a pre-encryption plaintext row — return
  // it unchanged so an account connected before encryption still works.
  if (parts.length !== 4 || parts[0] !== PREFIX) return value;

  const [, ivB, tagB, dataB] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
