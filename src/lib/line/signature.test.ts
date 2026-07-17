import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { verifySignature } from './signature';

const SECRET = 'test-channel-secret';
const BODY = JSON.stringify({ events: [{ type: 'message' }] });

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

describe('verifySignature', () => {
  it('accepts a signature produced with the channel secret', () => {
    expect(verifySignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(verifySignature(BODY, sign(BODY, 'attacker-secret'), SECRET)).toBe(false);
  });

  it('rejects a signature that does not match a tampered body', () => {
    expect(verifySignature('{"events":[]}', sign(BODY), SECRET)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifySignature(BODY, null, SECRET)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(() => verifySignature(BODY, 'short', SECRET)).not.toThrow();
    expect(verifySignature(BODY, 'short', SECRET)).toBe(false);
  });
});
