import { NextResponse } from 'next/server';

import { env } from '@/lib/env';

/**
 * Guards cron-only routes. Returns a response to send back when the caller is
 * not authorized, or null when it may proceed.
 *
 * Fails closed when CRON_SECRET is unset: an unauthenticated endpoint that
 * blasts messages to every user is worse than a broken cron job.
 */
export function authorizeCron(request: Request): NextResponse | null {
  const secret = env.CRON_SECRET;

  if (!secret) {
    console.error('CRON_SECRET is not set; refusing to run cron route');
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  }

  const header = request.headers.get('authorization');

  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
