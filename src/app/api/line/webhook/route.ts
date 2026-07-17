import type { webhook } from '@line/bot-sdk';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { replyText } from '@/lib/line/client';
import { handleTextMessage } from '@/lib/line/handler';
import { verifySignature } from '@/lib/line/signature';

export const runtime = 'nodejs';
// LINE calls this per message; a cached response would be silent data loss.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Read the raw bytes: request.json() would discard the exact body the
  // signature was computed over.
  const rawBody = await request.text();
  const signature = request.headers.get('x-line-signature');

  if (!verifySignature(rawBody, signature, env.LINE_CHANNEL_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let events: webhook.Event[];
  try {
    events = (JSON.parse(rawBody).events ?? []) as webhook.Event[];
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  // LINE retries the whole delivery on a non-2xx, which would re-record every
  // event in the batch. Handle each independently and always acknowledge.
  await Promise.all(events.map((event) => handleEvent(event).catch(logEventError)));

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: webhook.Event): Promise<void> {
  if (event.type !== 'message') return;

  const message = (event as webhook.MessageEvent).message;
  if (message.type !== 'text') return;

  // Absent for a user who has not added the bot, and on some source types.
  const userId = event.source?.userId;
  if (!userId) return;

  const replyToken = (event as webhook.MessageEvent).replyToken;
  const reply = await handleTextMessage(userId, (message as webhook.TextMessageContent).text);

  if (reply && replyToken) {
    await replyText(replyToken, reply);
  }
}

function logEventError(error: unknown): void {
  console.error('Failed to handle LINE event', error);
}
