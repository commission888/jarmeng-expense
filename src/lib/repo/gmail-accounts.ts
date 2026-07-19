import { decryptSecret, encryptSecret } from '@/lib/crypto';
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
 * PDPA: `refresh_token` is long-lived access to a user's mailbox, so it is
 * encrypted at rest here (and decrypted only in `listGmailAccounts`). The
 * encrypt/decrypt seam lives at this repo boundary so nothing else touches the
 * ciphertext. Needs `TOKEN_ENCRYPTION_KEY`.
 */
export async function saveGmailAccount(
  userId: string,
  email: string,
  refreshToken: string,
): Promise<void> {
  const { error } = await supabase()
    .from('gmail_accounts')
    .upsert(
      { user_id: userId, email, refresh_token: encryptSecret(refreshToken) },
      { onConflict: 'user_id,email' },
    );

  if (error) throw new Error(`Failed to save Gmail account: ${error.message}`);
}

export async function listGmailAccounts(): Promise<GmailAccountRecord[]> {
  const { data, error } = await supabase()
    .from('gmail_accounts')
    .select('id, user_id, email, refresh_token, last_synced_at');

  if (error) throw new Error(`Failed to list Gmail accounts: ${error.message}`);

  return (data ?? []).map((row) => ({
    ...(row as GmailAccountRecord),
    refresh_token: decryptSecret((row as GmailAccountRecord).refresh_token),
  }));
}

/**
 * Removes a mailbox connection — called when its refresh token is permanently
 * dead, so the sync stops retrying (and re-notifying) a token that can't work.
 * The user reconnects from the dashboard, which upserts a fresh row.
 */
export async function deleteGmailAccount(accountId: string): Promise<void> {
  const { error } = await supabase().from('gmail_accounts').delete().eq('id', accountId);

  if (error) console.error('Failed to delete Gmail account', error);
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

/**
 * Releases a claim so a later run can retry the message. Called when extraction
 * *throws* (a transient AI/network error) — a message that merely isn't a
 * transaction keeps its claim so it's skipped for good. Best-effort: retry only
 * happens if the message still falls in the next run's (advancing) sync window.
 */
export async function releaseEmail(userId: string, messageId: string): Promise<void> {
  const { error } = await supabase()
    .from('processed_emails')
    .delete()
    .eq('user_id', userId)
    .eq('gmail_message_id', messageId);

  if (error) console.error('Failed to release email claim', error);
}
