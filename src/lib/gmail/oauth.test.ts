import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('OAuth state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    process.env.LINE_CHANNEL_SECRET = 'state-signing-secret';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.GEMINI_API_KEY = 'gemini-key';
  });

  it('round-trips the LINE user id', async () => {
    const { signState, verifyState } = await import('./oauth');

    expect(verifyState(signState('U1234'))).toBe('U1234');
  });

  it('rejects a tampered payload', async () => {
    const { signState, verifyState } = await import('./oauth');

    const [, mac] = signState('U1234').split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'Uvictim', iat: Date.now() })).toString(
      'base64url',
    );

    expect(verifyState(`${forged}.${mac}`)).toBeNull();
  });

  it('rejects a malformed state', async () => {
    const { verifyState } = await import('./oauth');

    expect(verifyState('garbage')).toBeNull();
    expect(verifyState('')).toBeNull();
  });

  it('rejects a state older than the replay window', async () => {
    const { signState, verifyState } = await import('./oauth');

    const state = signState('U1234');

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    expect(verifyState(state)).toBeNull();
  });
});
