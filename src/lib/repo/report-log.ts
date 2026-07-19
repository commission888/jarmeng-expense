import { supabase } from '@/lib/supabase';

/**
 * Claims the monthly report for a user, atomically. Returns true when this call
 * won the claim (the caller should send), false when the row already existed
 * (already sent this month — skip).
 *
 * `ignoreDuplicates` maps to `INSERT ... ON CONFLICT DO NOTHING`, so the unique
 * (user_id, period_key) constraint decides the winner in one round trip — no
 * read-then-write race between concurrent or retried runs.
 */
export async function claimMonthlyReport(
  userId: string,
  periodKey: string,
): Promise<boolean> {
  const { data, error } = await supabase()
    .from('sent_reports')
    .upsert(
      { user_id: userId, period_key: periodKey },
      { onConflict: 'user_id,period_key', ignoreDuplicates: true },
    )
    .select('id');

  if (error) throw new Error(`Failed to claim monthly report: ${error.message}`);

  return (data?.length ?? 0) > 0;
}

/**
 * Releases a claim so a later run can retry — called when the push itself fails
 * after the claim was taken, so a transient LINE error doesn't cost the user
 * their report for the month.
 */
export async function releaseMonthlyReport(
  userId: string,
  periodKey: string,
): Promise<void> {
  const { error } = await supabase()
    .from('sent_reports')
    .delete()
    .eq('user_id', userId)
    .eq('period_key', periodKey);

  if (error) throw new Error(`Failed to release monthly report claim: ${error.message}`);
}
