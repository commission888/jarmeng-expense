import { env } from '@/lib/env';

const VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify';

interface VerifiedIdToken {
  lineUserId: string;
  displayName?: string;
}

/**
 * Verifies a LIFF ID token with LINE and returns the user it belongs to.
 *
 * The `client_id` is what binds the token to *our* channel: LINE checks it
 * against the token's `aud`, so without it a token minted for any other LINE
 * app would verify successfully here.
 *
 * The returned `sub` is matched against the `line_user_id` the webhook wrote.
 * Those agree only while the LINE Login channel and the Messaging API channel
 * sit under the SAME provider — LINE user ids are unique per provider, not per
 * channel. Split them across providers and every dashboard lookup silently
 * misses. See docs/SETUP.md § 4.
 */
export async function verifyIdToken(idToken: string): Promise<VerifiedIdToken | null> {
  const channelId = env.LINE_LOGIN_CHANNEL_ID;

  if (!channelId) {
    console.error('LINE_LOGIN_CHANNEL_ID is not set; refusing to verify ID tokens');
    return null;
  }

  const response = await fetch(VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { sub?: string; name?: string };

  if (!payload.sub) return null;

  return { lineUserId: payload.sub, displayName: payload.name };
}

/** Pulls the bearer token out of an Authorization header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');

  if (!header?.toLowerCase().startsWith('bearer ')) return null;

  const token = header.slice(7).trim();

  return token || null;
}
