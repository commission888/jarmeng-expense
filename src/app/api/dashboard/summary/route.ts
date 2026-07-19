import { NextResponse } from 'next/server';

import { bangkokMonthRange, bangkokMonthRangeForKey, isValidMonthKey } from '@/lib/format';
import { bearerToken, verifyIdToken } from '@/lib/line/verify-id-token';
import { listTransactions } from '@/lib/repo/transactions';
import { findUserByLineId } from '@/lib/repo/users';
import { summarize } from '@/lib/summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Feeds the LIFF dashboard. Authenticated by the caller's LINE ID token. */
export async function GET(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json({ error: 'Missing ID token' }, { status: 401 });
  }

  const verified = await verifyIdToken(token);

  if (!verified) {
    return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
  }

  // `month` only chooses the date window; the user is always scoped by the
  // verified token, so it can't be used to read someone else's data.
  const monthParam = new URL(request.url).searchParams.get('month');

  if (monthParam && !isValidMonthKey(monthParam)) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }

  const user = await findUserByLineId(verified.lineUserId);
  const { from, to, label, key } = monthParam
    ? bangkokMonthRangeForKey(monthParam)
    : bangkokMonthRange();

  // A user who has never messaged the bot has no row yet — that's an empty
  // dashboard, not an error.
  if (!user) {
    return NextResponse.json({
      month: label,
      monthKey: key,
      summary: summarize([]),
      transactions: [],
    });
  }

  const transactions = await listTransactions(user.id, from, to);

  return NextResponse.json({
    month: label,
    monthKey: key,
    summary: summarize(transactions),
    transactions,
  });
}
