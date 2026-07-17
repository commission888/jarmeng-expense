export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'bills',
  'health',
  'entertainment',
  'education',
  'other_expense',
] as const;

export const INCOME_CATEGORIES = [
  'salary',
  'bonus',
  'investment',
  'other_income',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type Category = ExpenseCategory | IncomeCategory;

export type Direction = 'income' | 'expense';
export type Source = 'line_chat' | 'gmail' | 'manual';

/** Thai labels — used in bot replies and the dashboard. */
export const CATEGORY_LABELS: Record<Category, string> = {
  food: 'อาหาร',
  transport: 'เดินทาง',
  shopping: 'ช้อปปิ้ง',
  bills: 'บิล/ค่าบริการ',
  health: 'สุขภาพ',
  entertainment: 'บันเทิง',
  education: 'การศึกษา',
  other_expense: 'อื่นๆ',
  salary: 'เงินเดือน',
  bonus: 'โบนัส',
  investment: 'การลงทุน',
  other_income: 'รายรับอื่นๆ',
};

export function categoriesFor(direction: Direction): readonly Category[] {
  return direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isCategoryFor(direction: Direction, value: string): value is Category {
  return (categoriesFor(direction) as readonly string[]).includes(value);
}

/** What the deterministic pass pulls out of a chat message, before categorization. */
export interface TransactionDraft {
  amount: number;
  description: string;
  /** Best deterministic guess; defaults to `expense` when the text gives no sign. */
  direction: Direction;
  /** True when the text itself said so (`+`, `-`, "เงินเดือน", "จ่าย"). When
   *  false, a keyword hit or the AI pass may override `direction`. */
  directionExplicit: boolean;
}

/** A draft plus its category — ready to persist. */
export interface ParsedTransaction extends TransactionDraft {
  category: Category;
  /** Where the category came from. `keyword` means we skipped the AI call. */
  categorySource: 'keyword' | 'ai' | 'fallback';
}
