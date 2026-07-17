import type { Category, Direction } from '@/lib/types';

export interface SummaryInput {
  direction: Direction;
  amount: number;
  category: Category;
}

export interface CategoryTotal {
  category: Category;
  amount: number;
  share: number;
}

export interface Summary {
  income: number;
  expense: number;
  net: number;
  count: number;
  /** Expense breakdown, largest first — what the dashboard and report chart. */
  expenseByCategory: CategoryTotal[];
}

/** Pure aggregation, shared by the bot's "สรุป" reply and the LIFF dashboard. */
export function summarize(transactions: readonly SummaryInput[]): Summary {
  let income = 0;
  let expense = 0;
  const buckets = new Map<Category, number>();

  for (const t of transactions) {
    if (t.direction === 'income') {
      income += t.amount;
      continue;
    }

    expense += t.amount;
    buckets.set(t.category, (buckets.get(t.category) ?? 0) + t.amount);
  }

  const expenseByCategory = [...buckets.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: expense > 0 ? amount / expense : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    income: round2(income),
    expense: round2(expense),
    net: round2(income - expense),
    count: transactions.length,
    expenseByCategory,
  };
}

/** Sums of 2-decimal amounts drift in binary floating point; snap them back. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
