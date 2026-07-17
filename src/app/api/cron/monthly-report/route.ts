import { NextResponse } from 'next/server';

import { authorizeCron } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 3 — SCAFFOLD, NOT IMPLEMENTED.
 *
 * The pieces already exist: `bangkokMonthRange()` gives the period,
 * `listTransactions()` reads it, and `summarize()` aggregates it — the same
 * functions behind the "สรุป" command. What remains:
 *
 *   1. iterate users (paginate — this runs against the whole table)
 *   2. summarize the *previous* month, skip users with no transactions
 *   3. push a Flex message via lineClient().pushMessage()
 *   4. savings advice on top of the summary
 *
 * Note push, not reply: there's no reply token outside a webhook event, and
 * push messages are metered on the LINE plan — budget before enabling.
 *
 * Wire the schedule in vercel.json once implemented.
 */
export async function POST(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  return NextResponse.json(
    { error: 'Monthly report is not implemented yet (Phase 3).' },
    { status: 501 },
  );
}
