import { supabase } from '@/lib/supabase';

export interface GmailAccountRecord {
  id: string;
  user_id: string;
  email: string;
  refresh_token: string;
  last_synced_at: string | null;
}

/**
 * Stores a mailbox connection.
 *
 * NOTE (PDPA): `refresh_token` is long-lived access to a user's mailbox. It is
 * kept in a service-role-only table, but before this goes to production it
 * should be encrypted at rest — see docs/SETUP.md § Gmail.
 */
export async function saveGmailAccount(
  userId: string,
  email: string,
  refreshToken: string,
): Promise<void> {
  const { error } = await supabase()
    .from('gmail_accounts')
    .upsert(
      { user_id: userId, email, refresh_token: refreshToken },
      { onConflict: 'user_id,email' },
    );

  if (error) throw new Error(`Failed to save Gmail account: ${error.message}`);
}

export async function listGmailAccounts(): Promise<GmailAccountRecord[]> {
  const { data, error } = await supabase()
    .from('gmail_accounts')
    .select('id, user_id, email, refresh_token, last_synced_at');

  if (error) throw new Error(`Failed to list Gmail accounts: ${error.message}`);

  return (data ?? []) as GmailAccountRecord[];
}

export async function markSynced(accountId: string): Promise<void> {
  const { error } = await supabase()
    .from('gmail_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', accountId);

  if (error) console.error('Failed to mark Gmail account synced', error);
}

/**
 * Claims a message id for processing. Returns false when it was already
 * claimed — Gmail redelivers, and this is what stops a double entry.
 */
export async function claimEmail(userId: string, messageId: string): Promise<boolean> {
  const { error } = await supabase()
    .from('processed_emails')
    .insert({ user_id: userId, gmail_message_id: messageId });

  // 23505 = unique_violation: someone already claimed it.
  if (error?.code === '23505') return false;
  if (error) throw new Error(`Failed to claim email: ${error.message}`);

  return true;
}
