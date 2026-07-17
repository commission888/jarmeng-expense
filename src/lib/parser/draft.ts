import type { Direction, TransactionDraft } from '@/lib/types';

/** Words that mark a message as income. Anything unmarked is treated as an expense. */
const INCOME_MARKERS = [
  'เงินเดือน',
  'รายรับ',
  'รายได้',
  'โบนัส',
  'ได้เงิน',
  'ได้รับ',
  'รับเงิน',
  'ขายได้',
  'ปันผล',
  'ดอกเบี้ย',
  'คืนเงิน',
  'salary',
  'bonus',
  'income',
  'refund',
];

const EXPENSE_MARKERS = ['จ่าย', 'ซื้อ', 'ค่า', 'รายจ่าย', 'เสีย'];

/** `1.5k` / `1.5พัน` → 1500. A bare number keeps its value. */
const THOUSAND_SUFFIXES = ['k', 'พัน'];

const CURRENCY_SUFFIXES = ['บาท', '฿', 'บ.'];

/**
 * Matches a number with optional thousands separators, decimals, currency
 * prefix, and a unit/multiplier suffix. Global — a message may hold several.
 */
const NUMBER_RE =
  /(฿)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|พัน|บาท|฿|บ\.)?/gi;

interface NumberMatch {
  value: number;
  start: number;
  end: number;
  hasCurrencyMarker: boolean;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function findNumbers(text: string): NumberMatch[] {
  const matches: NumberMatch[] = [];

  for (const m of text.matchAll(NUMBER_RE)) {
    const [full, currencyPrefix, digits, suffixRaw] = m;
    const suffix = (suffixRaw ?? '').toLowerCase();

    let value = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    if (THOUSAND_SUFFIXES.includes(suffix)) value *= 1000;

    matches.push({
      value,
      start: m.index,
      end: m.index + full.length,
      hasCurrencyMarker:
        Boolean(currencyPrefix) || CURRENCY_SUFFIXES.includes(suffix),
    });
  }

  return matches;
}

/**
 * Picks the number that represents the amount. A currency marker is the
 * strongest signal ("กาแฟ 2 แก้ว 100 บาท" → 100, not 2); without one, the
 * last number wins, since Thai phrasing puts the amount at the end.
 */
function pickAmount(matches: NumberMatch[]): NumberMatch | null {
  if (matches.length === 0) return null;

  const marked = matches.filter((m) => m.hasCurrencyMarker);
  const pool = marked.length > 0 ? marked : matches;

  return pool[pool.length - 1];
}

function detectDirection(text: string): { direction: Direction; explicit: boolean } {
  const trimmed = text.trimStart();

  if (trimmed.startsWith('+')) return { direction: 'income', explicit: true };
  if (trimmed.startsWith('-')) return { direction: 'expense', explicit: true };

  const lower = text.toLowerCase();
  if (INCOME_MARKERS.some((w) => lower.includes(w))) {
    return { direction: 'income', explicit: true };
  }
  if (EXPENSE_MARKERS.some((w) => lower.includes(w))) {
    return { direction: 'expense', explicit: true };
  }

  // Unmarked messages are overwhelmingly expenses; let a keyword hit or the
  // AI pass override this guess.
  return { direction: 'expense', explicit: false };
}

/**
 * Deterministic first pass over a chat message. Pure: no network, no database.
 * Returns null when the text holds no usable amount.
 */
export function extractDraft(text: string): TransactionDraft | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const amountMatch = pickAmount(findNumbers(normalized));
  if (!amountMatch || amountMatch.value <= 0) return null;

  const description = normalize(
    (normalized.slice(0, amountMatch.start) + ' ' + normalized.slice(amountMatch.end))
      .replace(/^[+\-\s]+/, '')
      .replace(/[.,;]+$/, ''),
  );

  const { direction, explicit } = detectDirection(normalized);

  return {
    amount: amountMatch.value,
    description,
    direction,
    directionExplicit: explicit,
  };
}

/**
 * The lookup key for the keyword table. Keeping this in one place means the
 * write path and the read path can never disagree on casing or spacing.
 */
export function keywordKey(description: string): string {
  return normalize(description).toLowerCase();
}
