import crypto from 'node:crypto';

/**
 * Verifies LINE's `x-line-signature` header against the raw request body.
 *
 * The body must be the exact bytes LINE sent — re-serializing parsed JSON
 * changes the signature and every request will fail.
 */
export function verifySignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  // timingSafeEqual throws on a length mismatch, so guard it first.
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
