import { describe, expect, it, vi } from 'vitest';

import type { AiClassifier } from '@/lib/ai/provider';
import type { TransactionDraft } from '@/lib/types';
import { categorize, type CategorizeDeps } from './categorize';

const draft: TransactionDraft = {
  amount: 50,
  description: 'กาแฟ',
  direction: 'expense',
  directionExplicit: false,
};

function makeDeps(overrides: Partial<CategorizeDeps> = {}): CategorizeDeps {
  const ai: AiClassifier = {
    classify: vi.fn().mockResolvedValue({ category: 'food', direction: 'expense' }),
  };

  return {
    lookupKeyword: vi.fn().mockResolvedValue(null),
    rememberKeyword: vi.fn().mockResolvedValue(undefined),
    ai,
    ...overrides,
  };
}

describe('categorize', () => {
  it('uses a keyword hit and skips the AI call entirely', async () => {
    const deps = makeDeps({
      lookupKeyword: vi.fn().mockResolvedValue({ category: 'food', direction: 'expense' }),
    });

    const result = await categorize(draft, deps);

    expect(result).toMatchObject({ category: 'food', categorySource: 'keyword' });
    expect(deps.ai.classify).not.toHaveBeenCalled();
  });

  it('lets a keyword hit correct an unmarked direction', async () => {
    const deps = makeDeps({
      lookupKeyword: vi.fn().mockResolvedValue({ category: 'salary', direction: 'income' }),
    });

    const result = await categorize(
      { ...draft, description: 'ค่าจ้าง', directionExplicit: false },
      deps,
    );

    expect(result.direction).toBe('income');
  });

  it('keeps an explicit direction even when the keyword disagrees', async () => {
    const deps = makeDeps({
      lookupKeyword: vi.fn().mockResolvedValue({ category: 'salary', direction: 'income' }),
    });

    const result = await categorize({ ...draft, directionExplicit: true }, deps);

    expect(result.direction).toBe('expense');
  });

  it('falls back to the AI on a miss and remembers the answer', async () => {
    const deps = makeDeps();

    const result = await categorize(draft, deps);

    expect(result).toMatchObject({ category: 'food', categorySource: 'ai' });
    expect(deps.rememberKeyword).toHaveBeenCalledWith('กาแฟ', {
      category: 'food',
      direction: 'expense',
    });
  });

  it('still records the transaction when the AI throws', async () => {
    const deps = makeDeps({
      ai: { classify: vi.fn().mockRejectedValue(new Error('quota exceeded')) },
    });

    const result = await categorize(draft, deps);

    expect(result).toMatchObject({ category: 'other_expense', categorySource: 'fallback' });
    expect(deps.rememberKeyword).not.toHaveBeenCalled();
  });

  it('does not persist a fallback guess as a learned keyword', async () => {
    const deps = makeDeps({ ai: { classify: vi.fn().mockResolvedValue(null) } });

    await categorize(draft, deps);

    expect(deps.rememberKeyword).not.toHaveBeenCalled();
  });

  it('survives a failing keyword write', async () => {
    const deps = makeDeps({
      rememberKeyword: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(categorize(draft, deps)).resolves.toMatchObject({ category: 'food' });
  });

  it('skips the keyword table when there is no description to key on', async () => {
    const deps = makeDeps();

    await categorize({ ...draft, description: '' }, deps);

    expect(deps.lookupKeyword).not.toHaveBeenCalled();
    expect(deps.rememberKeyword).not.toHaveBeenCalled();
  });
});
