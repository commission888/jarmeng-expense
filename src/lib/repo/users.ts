import { supabase } from '@/lib/supabase';

export interface UserRecord {
  id: string;
  line_user_id: string;
  display_name: string | null;
}

/**
 * Resolves a LINE user to our internal user row, creating it on first contact.
 * Upsert rather than select-then-insert: two messages arriving together would
 * otherwise race and one would hit the unique constraint.
 */
export async function ensureUser(lineUserId: string): Promise<UserRecord> {
  const { data, error } = await supabase()
    .from('users')
    .upsert({ line_user_id: lineUserId }, { onConflict: 'line_user_id' })
    .select('id, line_user_id, display_name')
    .single();

  if (error) throw new Error(`Failed to resolve user: ${error.message}`);

  return data as UserRecord;
}

/**
 * Every user row, streamed in pages. The monthly-report cron walks the whole
 * table, so it can't rely on the client's default 1000-row cap — we page with
 * `.range()` until a short page signals the end. Ordered by `created_at` so the
 * paging window is stable even if rows are inserted mid-run.
 */
export async function listAllUsers(pageSize = 1000): Promise<UserRecord[]> {
  const all: UserRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase()
      .from('users')
      .select('id, line_user_id, display_name')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to list users: ${error.message}`);

    const page = (data ?? []) as UserRecord[];
    all.push(...page);

    if (page.length < pageSize) break;
  }

  return all;
}

export async function findUserByLineId(lineUserId: string): Promise<UserRecord | null> {
  const { data, error } = await supabase()
    .from('users')
    .select('id, line_user_id, display_name')
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load user: ${error.message}`);

  return (data as UserRecord | null) ?? null;
}
