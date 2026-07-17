import { NextResponse } from 'next/server';

import { authorizeCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 2 — SCAFFOLD, NOT IMPLEMENTED.
 *
 * The OAuth half of Gmail sync is done (`/api/gmail/connect` → `/api/gmail/callback`
 * stores a refresh token), and the tables it needs exist. What remains:
 *
 *   1. for each row in `gmail_accounts`: refreshAccessToken(refresh_token)
 *   2. users.messages.list with a bank/payment sender query, newer_than the
 *      account's last_synced_at
 *   3. claimEmail(userId, messageId) — skip when it returns false (dedupe)
 *   4. extract amount/merchant/date from the body via an AI classifier, then
 *      reuse `categorize()` so keyword learning is shared with the chat path
 *   5. insertTransaction(..., source: 'gmail'), then markSynced(account.id)
 *
 * Per the PRD's PDPA line, step 4 must persist only the extracted fields —
 * never the email body.
 *
 * Wire the schedule in vercel.json once implemented.
 */
export async function POST(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  return NextResponse.json(
    { error: 'Gmail sync is not implemented yet (Phase 2).' },
    { status: 501 },
  );
}
