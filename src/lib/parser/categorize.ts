import type { AiClassifier } from '@/lib/ai/provider';
import type { Category, Direction, ParsedTransaction, TransactionDraft } from '@/lib/types';
import { keywordKey } from './draft';

export interface KeywordHit {
  category: Category;
  direction: Direction;
}

/**
 * The two dependencies the categorizer needs, as plain functions. The webhook
 * supplies Supabase-backed ones; tests supply stubs.
 */
export interface CategorizeDeps {
  lookupKeyword(key: string): Promise<KeywordHit | null>;
  rememberKeyword(key: string, hit: KeywordHit): Promise<void>;
  ai: AiClassifier;
}

const FALLBACK: Record<Direction, Category> = {
  expense: 'other_expense',
  income: 'other_income',
};

/**
 * Resolves a draft's category, cheapest path first:
 *
 *   1. this user's keyword table  — free, no AI call
 *   2. the AI classifier         — on a miss; the result is written back
 *   3. an "other" fallback       — so a failing AI never drops the entry
 *
 * Step 3 matters: the user's message is already in hand, and losing it to a
 * provider outage would be worse than filing it under "อื่นๆ".
 */
export async function categorize(
  draft: TransactionDraft,
  deps: CategorizeDeps,
): Promise<ParsedTransaction> {
  const key = keywordKey(draft.description);

  if (key) {
    const hit = await deps.lookupKeyword(key);
    if (hit) {
      return {
        ...draft,
        // An explicit "+"/"เงินเดือน" in *this* message outranks what we
        // learned from past ones.
        direction: draft.directionExplicit ? draft.direction : hit.direction,
        category: hit.category,
        categorySource: 'keyword',
      };
    }
  }

  const classification = await classifyQuietly(draft, deps.ai);

  if (!classification) {
    return {
      ...draft,
      category: FALLBACK[draft.direction],
      categorySource: 'fallback',
    };
  }

  // Only teach the table things it can look up again, and never teach it a
  // guess we ourselves fell back on.
  if (key) {
    await rememberQuietly(deps, key, classification);
  }

  return { ...draft, ...classification, categorySource: 'ai' };
}

async function classifyQuietly(draft: TransactionDraft, ai: AiClassifier) {
  try {
    return await ai.classify({
      description: draft.description,
      amount: draft.amount,
      direction: draft.direction,
      directionLocked: draft.directionExplicit,
    });
  } catch (error) {
    console.error('AI classification failed; using fallback category', error);
    return null;
  }
}

async function rememberQuietly(deps: CategorizeDeps, key: string, hit: KeywordHit) {
  try {
    await deps.rememberKeyword(key, hit);
  } catch (error) {
    // A failed cache write costs one AI call next time — not the transaction.
    console.error('Failed to persist keyword mapping', error);
  }
}
