import { describe, expect, it } from 'vitest';

import { coerceExtraction } from './gemini-email';

describe('coerceExtraction', () => {
  it('accepts a well-formed expense', () => {
    expect(
      coerceExtraction({
        isTransaction: true,
        amount: 250.5,
        merchant: 'Starbucks',
        direction: 'expense',
      }),
    ).toEqual({ amount: 250.5, merchant: 'Starbucks', direction: 'expense' });
  });

  it('rejects a non-transaction email', () => {
    expect(
      coerceExtraction({ isTransaction: false, amount: 999, merchant: 'OTP', direction: 'expense' }),
    ).toBeNull();
  });

  it('rejects a missing or non-positive amount', () => {
    expect(coerceExtraction({ isTransaction: true, direction: 'expense' })).toBeNull();
    expect(
      coerceExtraction({ isTransaction: true, amount: 0, merchant: 'x', direction: 'expense' }),
    ).toBeNull();
    expect(
      coerceExtraction({ isTransaction: true, amount: -5, merchant: 'x', direction: 'expense' }),
    ).toBeNull();
  });

  it('rejects an invalid direction', () => {
    expect(
      coerceExtraction({ isTransaction: true, amount: 10, merchant: 'x', direction: 'sideways' }),
    ).toBeNull();
  });

  it('falls back to a placeholder when the merchant is blank', () => {
    expect(
      coerceExtraction({ isTransaction: true, amount: 10, merchant: '  ', direction: 'income' }),
    ).toEqual({ amount: 10, merchant: 'ไม่ระบุ', direction: 'income' });
  });

  it('rejects a non-object', () => {
    expect(coerceExtraction(null)).toBeNull();
    expect(coerceExtraction('nope')).toBeNull();
  });
});
