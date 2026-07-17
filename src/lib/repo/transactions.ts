import { supabase } from '@/lib/supabase';
import type { Category, Direction, ParsedTransaction, Source } from '@/lib/types';

export interface TransactionRecord {
  id: string;
  direction: Direction;
  amount: number;
  category: Category;
  description: string | null;
  source: Source;
  occurred_at: string;
}

export async function insertTransaction(
  userId: string,
  parsed: ParsedTransaction,
  source: Source = 'line_chat',
  occurredAt: Date = new Date(),
): Promise<TransactionRecord> {
  const { data, error } = await supabase()
    .from('transactions')
    .insert({
      user_id: userId,
      direction: parsed.direction,
      amount: parsed.amount,
      category: parsed.category,
      description: parsed.description || null,
      source,
      occurred_at: occurredAt.toISOString(),
    })
    .select('id, direction, amount, category, description, source, occurred_at')
    .single();

  if (error) throw new Error(`Failed to save transaction: ${error.message}`);

  return data as TransactionRecord;
}

export async function listTransactions(
  userId: string,
  from: Date,
  to: Date,
): Promise<TransactionRecord[]> {
  const { data, error } = await supabase()
    .from('transactions')
    .select('id, direction, amount, category, description, source, occurred_at')
    .eq('user_id', userId)
    .gte('occurred_at', from.toISOString())
    .lt('occurred_at', to.toISOString())
    .order('occurred_at', { ascending: false });

  if (error) throw new Error(`Failed to load transactions: ${error.message}`);

  return (data ?? []) as TransactionRecord[];
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from('transactions')
    .delete()
    // Scoped by user_id as well as id: an id alone would let any caller who
    // guesses a uuid delete someone else's row.
    .eq('user_id', userId)
    .eq('id', id)
    .select('id');

  if (error) throw new Error(`Failed to delete transaction: ${error.message}`);

  return (data?.length ?? 0) > 0;
}

/** Most recent entry for this user — backs the "ลบ" (undo) command. */
export async function latestTransaction(userId: string): Promise<TransactionRecord | null> {
  const { data, error } = await supabase()
    .from('transactions')
    .select('id, direction, amount, category, description, source, occurred_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load latest transaction: ${error.message}`);

  return (data as TransactionRecord | null) ?? null;
}
