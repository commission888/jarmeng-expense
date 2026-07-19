import crypto from 'node:crypto';

import { env } from '@/lib/env';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/** Read-only: the PRD only ever needs to extract, never to modify a mailbox. */
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'email'];

function googleConfig() {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Gmail sync is not configured — see .env.example (Phase 2).');
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Signs the LINE user id into the OAuth `state`.
 *
 * The callback has no session to trust, so an unsigned state would let anyone
 * attach their own mailbox to someone else's account by editing the URL.
 */
export function signState(lineUserId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: lineUserId, iat: Date.now() }),
  ).toString('base64url');

  const mac = crypto
    .createHmac('sha256', env.LINE_CHANNEL_SECRET)
    .update(payload)
    .digest('base64url');

  return `${payload}.${mac}`;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export function verifyState(state: string): string | null {
  const [payload, mac] = state.split('.');
  if (!payload || !mac) return null;

  const expected = crypto
    .createHmac('sha256', env.LINE_CHANNEL_SECRET)
    .update(payload)
    .digest('base64url');

  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const { sub, iat } = JSON.parse(Buffer.from(payload, 'base64url').toString());

    if (typeof sub !== 'string' || typeof iat !== 'number') return null;
    // Bound the replay window: a leaked consent URL shouldn't work forever.
    if (Date.now() - iat > STATE_MAX_AGE_MS) return null;

    return sub;
  } catch {
    return null;
  }
}

export function buildConsentUrl(lineUserId: string): string {
  const { clientId, redirectUri } = googleConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // Required together to actually receive a refresh token from Google.
    access_type: 'offline',
    prompt: 'consent',
    state: signState(lineUserId),
  });

  return `${AUTH_ENDPOINT}?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = googleConfig();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Thrown when a refresh token is permanently unusable (expired or revoked) — as
 * opposed to a transient network/5xx error. The sync uses this to tell "ask the
 * user to reconnect" apart from "retry next run". Testing-mode Google apps expire
 * refresh tokens after 7 days, so this is not a rare path.
 */
export class GmailAuthError extends Error {
  constructor(message = 'Gmail refresh token is no longer valid') {
    super(message);
    this.name = 'GmailAuthError';
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = googleConfig();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // Google answers a dead refresh token with 400 invalid_grant. Everything
    // else (5xx, network) is transient and should just retry next run.
    if (response.status === 400 && body.includes('invalid_grant')) {
      throw new GmailAuthError();
    }
    throw new Error(`Token refresh failed: ${body}`);
  }

  const { access_token } = (await response.json()) as TokenResponse;

  return access_token;
}
