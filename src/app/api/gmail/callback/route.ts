import { NextResponse } from 'next/server';

import { exchangeCode, verifyState } from '@/lib/gmail/oauth';
import { saveGmailAccount } from '@/lib/repo/gmail-accounts';
import { ensureUser } from '@/lib/repo/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Phase 2 — Google redirects the user here after consent. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return html(`เชื่อมต่อไม่สำเร็จ: ${error}`);
  if (!code || !state) return html('คำขอไม่ถูกต้อง');

  const lineUserId = verifyState(state);
  if (!lineUserId) return html('คำขอหมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่');

  try {
    const tokens = await exchangeCode(code);

    // Without a refresh token we can only read the mailbox for an hour, which
    // is not a working sync — tell the user instead of storing a dead account.
    if (!tokens.refresh_token) {
      return html('ไม่ได้รับสิทธิ์ระยะยาว กรุณาถอนสิทธิ์ในบัญชี Google แล้วลองใหม่');
    }

    const email = await fetchEmailAddress(tokens.access_token);
    const user = await ensureUser(lineUserId);

    await saveGmailAccount(user.id, email, tokens.refresh_token);

    return html(`เชื่อมต่อ ${email} สำเร็จแล้ว ✅ กลับไปที่ LINE ได้เลยครับ`);
  } catch (err) {
    console.error('Gmail callback failed', err);
    return html('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่');
  }
}

async function fetchEmailAddress(accessToken: string): Promise<string> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Failed to read Gmail profile');

  const { emailAddress } = (await response.json()) as { emailAddress: string };

  return emailAddress;
}

function html(message: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui,sans-serif;padding:32px;text-align:center">${message}</body>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
