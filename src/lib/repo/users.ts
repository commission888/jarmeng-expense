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

export async function findUserByLineId(lineUserId: string): Promise<UserRecord | null> {
  const { data, error } = await supabase()
    .from('users')
    .select('id, line_user_id, display_name')
    .eq('line_user_id', lineUserId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load user: ${error.message}`);

  return (data as UserRecord | null) ?? null;
}
