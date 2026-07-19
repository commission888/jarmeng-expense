import { NextResponse } from 'next/server';

import { authorizeCron } from '@/lib/cron-auth';
import { bangkokMonthRange } from '@/lib/format';
import { lineClient } from '@/lib/line/client';
import { listTransactions } from '@/lib/repo/transactions';
import { listAllUsers } from '@/lib/repo/users';
import { buildReportFlex } from '@/lib/report';
import { summarize } from '@/lib/summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 3 — monthly savings report.
 *
 * Runs on the 1st (see `vercel.json`) and pushes each user a Flex summary of the
 * *previous* month plus a savings nudge. Push, not reply: there's no reply token
 * outside a webhook event, and push messages are metered on the LINE plan.
 *
 * GET, not POST: Vercel Cron invokes the path with a GET and, when `CRON_SECRET`
 * is set, injects `Authorization: Bearer <secret>` — which is what `authorizeCron`
 * checks. Per-user failures are swallowed so one bad recipient can't abort the
 * run; a total failure lets Vercel retry, which re-sends from the top — acceptable
 * at this scale, revisit with a "sent this month" ledger if the user base grows.
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  // The 1st of the new month has just begun in Bangkok; step back one second to
  // land in the month we're reporting on.
  const thisMonth = bangkokMonthRange();
  const { from, to, label } = bangkokMonthRange(new Date(thisMonth.from.getTime() - 1000));

  const users = await listAllUsers();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const transactions = await listTransactions(user.id, from, to);

      if (transactions.length === 0) {
        skipped += 1;
        continue;
      }

      const summary = summarize(transactions);

      await lineClient().pushMessage({
        to: user.line_user_id,
        messages: [buildReportFlex(label, summary)],
      });

      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Monthly report failed for user ${user.id}`, error);
    }
  }

  return NextResponse.json({ month: label, users: users.length, sent, skipped, failed });
}
