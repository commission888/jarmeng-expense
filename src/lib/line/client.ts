import { messagingApi } from '@line/bot-sdk';

import { env } from '@/lib/env';

let client: messagingApi.MessagingApiClient | null = null;

export function lineClient(): messagingApi.MessagingApiClient {
  client ??= new messagingApi.MessagingApiClient({
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
  });

  return client;
}

/**
 * Replies with plain text. A reply token is single-use and expires in ~1 minute,
 * so a failure here is logged rather than retried — the transaction is already
 * saved and re-throwing would make LINE redeliver the whole event.
 */
export async function replyText(replyToken: string, text: string): Promise<void> {
  try {
    await lineClient().replyMessage({
      replyToken,
      messages: [{ type: 'text', text }],
    });
  } catch (error) {
    console.error('Failed to send LINE reply', error);
  }
}
