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

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.LINE_CHANNEL_SECRET = 'x';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'x';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
    process.env.GEMINI_API_KEY = 'x';
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    process.env.GOOGLE_REDIRECT_URI = 'https://app.example.com/api/gmail/callback';
  });

  it('flags a dead token (400 invalid_grant) as a GmailAuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 })),
    );
    const { refreshAccessToken, GmailAuthError } = await import('./oauth');

    await expect(refreshAccessToken('dead')).rejects.toBeInstanceOf(GmailAuthError);
  });

  it('treats a transient 5xx as a plain error, not a reconnect signal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('upstream boom', { status: 503 })),
    );
    const { refreshAccessToken, GmailAuthError } = await import('./oauth');

    const error = await refreshAccessToken('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(GmailAuthError);
  });

  it('returns the access token on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"access_token":"at-123","expires_in":3599}', { status: 200 }),
      ),
    );
    const { refreshAccessToken } = await import('./oauth');

    expect(await refreshAccessToken('good')).toBe('at-123');
  });
});
