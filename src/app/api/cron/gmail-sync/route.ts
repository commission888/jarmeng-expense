import { NextResponse } from 'next/server';

import { GeminiClassifier } from '@/lib/ai/gemini';
import { GeminiEmailExtractor } from '@/lib/ai/gemini-email';
import { authorizeCron } from '@/lib/cron-auth';
import { buildSyncQuery, getMessage, listMessageIds } from '@/lib/gmail/api';
import { GmailAuthError, refreshAccessToken } from '@/lib/gmail/oauth';
import { lineClient } from '@/lib/line/client';
import { keywordKey } from '@/lib/parser/draft';
import { categorize, type CategorizeDeps } from '@/lib/parser/categorize';
import {
  claimEmail,
  deleteGmailAccount,
  listGmailAccounts,
  markSynced,
  releaseEmail,
} from '@/lib/repo/gmail-accounts';
import { lookupKeyword, rememberKeyword, touchKeyword } from '@/lib/repo/keywords';
import { insertTransaction } from '@/lib/repo/transactions';
import { getLineUserId } from '@/lib/repo/users';
import type { TransactionDraft } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Each message is a fetch plus up to two sequential Gemini calls, so give the
// batch room. `listMessageIds` caps at 50 with no pagination: one run is bounded,
// and because a timed-out run skips `markSynced` while `claimEmail` dedupes what
// already landed, successive runs make forward progress over a large backlog.
export const maxDuration = 60;

/**
 * Phase 2 — Gmail sync.
 *
 * For each connected mailbox: refresh the access token, pull recent bank/payment
 * mail newer than the last sync, and for each new message extract the
 * transaction with the AI, categorize it (reusing the chat path's keyword
 * learning), and record it as a `gmail` transaction.
 *
 * GET, not POST: Vercel Cron invokes with GET and injects the `CRON_SECRET`
 * bearer that `authorizeCron` checks. Wire the schedule in `vercel.json`.
 *
 * PDPA: the email body lives only in memory on its way to the extractor — only
 * the extracted fields are persisted, never the body.
 *
 * Claim semantics (via `processed_emails`): claim before extracting. A message
 * that isn't a transaction keeps its claim (skip it for good); a message whose
 * processing *throws* releases its claim. Note the retry is best-effort: the
 * account's sync window always advances (so a poison message can't wedge it),
 * so a released message is only re-listed if it falls in the next run's window.
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const accounts = await listGmailAccounts();
  const extractor = new GeminiEmailExtractor();
  const classifier = new GeminiClassifier();

  let recorded = 0;
  let skipped = 0;
  let failed = 0;
  let reconnectsRequested = 0;

  for (const account of accounts) {
    try {
      const accessToken = await refreshAccessToken(account.refresh_token);
      const ids = await listMessageIds(accessToken, buildSyncQuery(account.last_synced_at));

      for (const id of ids) {
        // Dedupe: Gmail redelivers, and a boundary-day overlap re-lists messages.
        if (!(await claimEmail(account.user_id, id))) {
          skipped += 1;
          continue;
        }

        try {
          const message = await getMessage(accessToken, id);
          const extracted = await extractor.extract({
            subject: message.subject,
            from: message.from,
            text: message.text,
          });

          // Not a transaction (OTP, promo). Keep the claim so we never re-ask.
          if (!extracted) {
            skipped += 1;
            continue;
          }

          const draft: TransactionDraft = {
            amount: extracted.amount,
            description: extracted.merchant,
            direction: extracted.direction,
            // The extractor decided the direction from the email — lock it.
            directionExplicit: true,
          };

          const deps: CategorizeDeps = {
            lookupKeyword: (key) => lookupKeyword(account.user_id, key),
            rememberKeyword: (key, hit) => rememberKeyword(account.user_id, key, hit),
            ai: classifier,
          };

          const parsed = await categorize(draft, deps);
          await insertTransaction(account.user_id, parsed, 'gmail', message.receivedAt);

          if (parsed.categorySource === 'keyword') {
            void touchKeyword(account.user_id, keywordKey(draft.description));
          }

          recorded += 1;
        } catch (messageError) {
          // Transient failure — give the claim back so the next run retries.
          await releaseEmail(account.user_id, id);
          failed += 1;
          console.error(`Gmail sync failed for message ${id}`, messageError);
        }
      }

      // Only advance the window after a clean pass over this account.
      await markSynced(account.id);
    } catch (accountError) {
      // A dead refresh token can't fix itself — tell the user to reconnect and
      // drop the account so we don't retry (and re-notify) a token that's gone.
      if (accountError instanceof GmailAuthError) {
        await requestReconnect(account.user_id);
        await deleteGmailAccount(account.id);
        reconnectsRequested += 1;
      } else {
        failed += 1;
        console.error(`Gmail sync failed for account ${account.id}`, accountError);
      }
    }
  }

  return NextResponse.json({
    accounts: accounts.length,
    recorded,
    skipped,
    failed,
    reconnectsRequested,
  });
}

/**
 * Pushes a "please reconnect Gmail" nudge. Best-effort: a push failure is logged,
 * not thrown — the account is being dropped regardless, so we don't want a LINE
 * hiccup to leave a dead token in place.
 */
async function requestReconnect(userId: string): Promise<void> {
  try {
    const lineUserId = await getLineUserId(userId);
    if (!lineUserId) return;

    await lineClient().pushMessage({
      to: lineUserId,
      messages: [
        {
          type: 'text',
          text: [
            '⚠️ การเชื่อมต่อ Gmail หมดอายุแล้ว',
            'ระบบจึงหยุดดึงรายจ่ายจากอีเมลให้ชั่วคราว',
            '',
            'เปิดแดชบอร์ดแล้วกด "เชื่อมต่อ Gmail" อีกครั้ง เพื่อดึงต่อได้เลยครับ',
          ].join('\n'),
        },
      ],
    });
  } catch (error) {
    console.error(`Failed to notify user ${userId} to reconnect Gmail`, error);
  }
}
