import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('secret encryption', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LINE_CHANNEL_SECRET = 'x';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'x';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
    process.env.GEMINI_API_KEY = 'x';
    process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(64); // 32 zero bytes
  });

  it('round-trips a secret and never stores it in the clear', async () => {
    const { encryptSecret, decryptSecret } = await import('./crypto');

    const token = '1//refresh-token-abc';
    const enc = encryptSecret(token);

    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain(token);
    expect(decryptSecret(enc)).toBe(token);
  });

  it('uses a fresh iv, so the same input encrypts differently each time', async () => {
    const { encryptSecret } = await import('./crypto');

    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('passes a legacy plaintext value through unchanged', async () => {
    const { decryptSecret } = await import('./crypto');

    expect(decryptSecret('plain-legacy-token')).toBe('plain-legacy-token');
  });

  it('rejects a tampered ciphertext', async () => {
    const { encryptSecret, decryptSecret } = await import('./crypto');

    const parts = encryptSecret('secret').split('.');
    parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1); // corrupt the auth tag

    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });
});
