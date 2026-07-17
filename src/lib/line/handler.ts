import { GeminiClassifier } from '@/lib/ai/gemini';
import { bangkokMonthRange, categoryLabel, formatBaht } from '@/lib/format';
import { categorize } from '@/lib/parser/categorize';
import { extractDraft, keywordKey } from '@/lib/parser/draft';
import { lookupKeyword, rememberKeyword, touchKeyword } from '@/lib/repo/keywords';
import {
  deleteTransaction,
  insertTransaction,
  latestTransaction,
  listTransactions,
} from '@/lib/repo/transactions';
import { ensureUser } from '@/lib/repo/users';
import { summarize } from '@/lib/summary';
import type { TransactionDraft } from '@/lib/types';

const HELP_TEXT = [
  'จาเหมง รายรับรายจ่าย 📒',
  '',
  'บันทึกรายจ่าย: พิมพ์ "กาแฟ 50" หรือ "ค่าน้ำ 300 บาท"',
  'บันทึกรายรับ: พิมพ์ "+30000 ฟรีแลนซ์" หรือ "เงินเดือน 45000"',
  '',
  'คำสั่ง:',
  '• สรุป — ดูยอดเดือนนี้',
  '• ลบ — ลบรายการล่าสุด',
  '• ช่วยเหลือ — ดูคำสั่งทั้งหมด',
].join('\n');

const HELP_COMMANDS = ['ช่วยเหลือ', 'help', 'วิธีใช้', '?'];
const SUMMARY_COMMANDS = ['สรุป', 'summary', 'ยอด'];
const UNDO_COMMANDS = ['ลบ', 'undo', 'ยกเลิก'];

/**
 * Turns one text message into a reply. Returns the text to send back, or null
 * when the message isn't for us (chit-chat with no amount).
 */
export async function handleTextMessage(
  lineUserId: string,
  text: string,
): Promise<string | null> {
  const command = text.trim().toLowerCase();

  if (HELP_COMMANDS.includes(command)) return HELP_TEXT;

  if (SUMMARY_COMMANDS.includes(command)) {
    return buildSummaryReply((await ensureUser(lineUserId)).id);
  }

  if (UNDO_COMMANDS.includes(command)) {
    return undoLatest((await ensureUser(lineUserId)).id);
  }

  const draft = extractDraft(text);

  // No amount in the message — stay quiet rather than reply to every message
  // in a group chat, and don't create a user row for someone who only said
  // "สวัสดี".
  if (!draft) return null;

  return recordTransaction((await ensureUser(lineUserId)).id, draft);
}

async function recordTransaction(
  userId: string,
  draft: TransactionDraft,
): Promise<string> {
  const parsed = await categorize(draft, {
    lookupKeyword: (key) => lookupKeyword(userId, key),
    rememberKeyword: (key, hit) => rememberKeyword(userId, key, hit),
    ai: new GeminiClassifier(),
  });

  const saved = await insertTransaction(userId, parsed);

  if (parsed.categorySource === 'keyword') {
    void touchKeyword(userId, keywordKey(draft.description));
  }

  const sign = parsed.direction === 'income' ? '📥 รายรับ' : '📤 รายจ่าย';
  const name = parsed.description || 'ไม่ระบุ';

  return [
    `${sign} บันทึกแล้ว ✅`,
    `${name} — ${formatBaht(saved.amount)}`,
    `หมวด: ${categoryLabel(parsed.category)}`,
  ].join('\n');
}

async function buildSummaryReply(userId: string): Promise<string> {
  const { from, to, label } = bangkokMonthRange();
  const transactions = await listTransactions(userId, from, to);

  if (transactions.length === 0) {
    return `ยังไม่มีรายการในเดือน${label} ครับ`;
  }

  const summary = summarize(transactions);

  const top = summary.expenseByCategory
    .slice(0, 5)
    .map((c) => `• ${categoryLabel(c.category)} — ${formatBaht(c.amount)} (${Math.round(c.share * 100)}%)`);

  return [
    `📊 สรุปเดือน${label}`,
    '',
    `📥 รายรับ: ${formatBaht(summary.income)}`,
    `📤 รายจ่าย: ${formatBaht(summary.expense)}`,
    `${summary.net >= 0 ? '💰 คงเหลือ' : '⚠️ ติดลบ'}: ${formatBaht(Math.abs(summary.net))}`,
    '',
    'หมวดที่ใช้มากที่สุด:',
    ...top,
    '',
    `รวม ${summary.count} รายการ`,
  ].join('\n');
}

async function undoLatest(userId: string): Promise<string> {
  const latest = await latestTransaction(userId);

  if (!latest) return 'ยังไม่มีรายการให้ลบครับ';

  const removed = await deleteTransaction(userId, latest.id);

  if (!removed) return 'ลบไม่สำเร็จ ลองใหม่อีกครั้งครับ';

  return `🗑️ ลบแล้ว: ${latest.description ?? 'ไม่ระบุ'} — ${formatBaht(latest.amount)}`;
}
