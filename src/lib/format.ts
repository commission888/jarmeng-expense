import { CATEGORY_LABELS, type Category } from '@/lib/types';

const baht = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatBaht(amount: number): string {
  return `${baht.format(amount)} บาท`;
}

export function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * The month boundaries for a Bangkok-local month, returned as UTC instants.
 * Thailand has no DST and a fixed +07:00 offset, so a fixed offset is exact
 * here — a server running in UTC must not slice months by its own clock.
 */
export function bangkokMonthRange(reference: Date = new Date()): {
  from: Date;
  to: Date;
  label: string;
  /** Machine-friendly `YYYY-MM`, e.g. `2026-07` — what the dashboard passes back
   *  to pick a month, and what the report cron could key a "sent" ledger on. */
  key: string;
} {
  const local = new Date(reference.getTime() + 7 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();

  const from = new Date(Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000);
  const to = new Date(Date.UTC(year, month + 1, 1) - 7 * 60 * 60 * 1000);

  const label = new Intl.DateTimeFormat('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(from);

  const key = `${year}-${String(month + 1).padStart(2, '0')}`;

  return { from, to, label, key };
}

/** `YYYY-MM` with the month clamped to 01–12 — rejects `2026-13` and `2026-00`. */
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(key: string): boolean {
  return MONTH_KEY.test(key);
}

/** The current Bangkok month as a `YYYY-MM` key — the dashboard's default view. */
export function currentMonthKey(): string {
  return bangkokMonthRange().key;
}

/**
 * Midday UTC on the 15th of the month — comfortably inside the Bangkok month
 * whichever way the ±7h offset falls, so it's a safe reference for
 * `bangkokMonthRange()`. Callers pass a validated key.
 */
function monthReference(key: string): Date {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 15, 12));
}

/** The Bangkok month boundaries for a given `YYYY-MM` key. */
export function bangkokMonthRangeForKey(key: string) {
  return bangkokMonthRange(monthReference(key));
}

/** The Thai display label for a `YYYY-MM` key, e.g. `กรกฎาคม 2569`. */
export function monthLabel(key: string): string {
  return bangkokMonthRangeForKey(key).label;
}

/** Shift a `YYYY-MM` key by whole months, rolling the year over as needed. */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}
