import { NextResponse } from 'next/server';

import { buildConsentUrl } from '@/lib/gmail/oauth';
import { bearerToken, verifyIdToken } from '@/lib/line/verify-id-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 2 — starts Gmail consent. Called from the LIFF page with the user's
 * LINE ID token; returns the Google URL for the client to navigate to.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Missing ID token' }, { status: 401 });
  }

  const verified = await verifyIdToken(token);

  if (!verified) {
    return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
  }

  try {
    return NextResponse.json({ url: buildConsentUrl(verified.lineUserId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gmail sync unavailable' },
      { status: 503 },
    );
  }
}
