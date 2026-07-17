import type { KeywordHit } from '@/lib/parser/categorize';
import { supabase } from '@/lib/supabase';
import { isCategoryFor, type Direction } from '@/lib/types';

/**
 * Looks up what this user's past behaviour says about a keyword. Mappings are
 * per-user by design — "แมค" is McDonald's to one person and a MacBook to another.
 */
export async function lookupKeyword(
  userId: string,
  key: string,
): Promise<KeywordHit | null> {
  const { data, error } = await supabase()
    .from('keywords')
    .select('category, direction')
    .eq('user_id', userId)
    .eq('keyword', key)
    .maybeSingle();

  if (error) {
    // A lookup failure should cost an AI call, not the whole message.
    console.error('Keyword lookup failed', error);
    return null;
  }

  if (!data) return null;

  const direction = data.direction as Direction;
  const category = data.category as string;

  // The table is written by an earlier version of our own taxonomy; a renamed
  // category must not resurrect as an invalid value.
  if (!isCategoryFor(direction, category)) return null;

  return { category, direction };
}

export async function rememberKeyword(
  userId: string,
  key: string,
  hit: KeywordHit,
): Promise<void> {
  const { error } = await supabase()
    .from('keywords')
    .upsert(
      {
        user_id: userId,
        keyword: key,
        category: hit.category,
        direction: hit.direction,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,keyword' },
    );

  if (error) throw new Error(`Failed to store keyword: ${error.message}`);
}

/** Bumps usage stats. Best-effort: never block a reply on it. */
export async function touchKeyword(userId: string, key: string): Promise<void> {
  const { error } = await supabase().rpc('touch_keyword', {
    p_user_id: userId,
    p_keyword: key,
  });

  if (error) console.error('Failed to bump keyword hit_count', error);
}
