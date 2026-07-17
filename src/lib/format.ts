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

  return { from, to, label };
}
