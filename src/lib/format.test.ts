import { describe, expect, it } from 'vitest';

import {
  bangkokMonthRange,
  bangkokMonthRangeForKey,
  isValidMonthKey,
  monthLabel,
  shiftMonth,
} from './format';

describe('bangkokMonthRange', () => {
  it('keys the month a Bangkok-local instant falls in', () => {
    // 2026-07-31 20:00 UTC is 2026-08-01 03:00 in Bangkok — the next month.
    expect(bangkokMonthRange(new Date('2026-07-31T20:00:00Z')).key).toBe('2026-08');
    // 2026-07-31 16:00 UTC is still 2026-07-31 23:00 in Bangkok.
    expect(bangkokMonthRange(new Date('2026-07-31T16:00:00Z')).key).toBe('2026-07');
  });
});

describe('isValidMonthKey', () => {
  it('accepts a padded YYYY-MM', () => {
    expect(isValidMonthKey('2026-07')).toBe(true);
    expect(isValidMonthKey('2026-01')).toBe(true);
    expect(isValidMonthKey('2026-12')).toBe(true);
  });

  it('rejects out-of-range or malformed months', () => {
    expect(isValidMonthKey('2026-00')).toBe(false);
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-7')).toBe(false);
    expect(isValidMonthKey('26-07')).toBe(false);
    expect(isValidMonthKey('2026/07')).toBe(false);
  });
});

describe('shiftMonth', () => {
  it('steps within a year', () => {
    expect(shiftMonth('2026-07', -1)).toBe('2026-06');
    expect(shiftMonth('2026-07', 1)).toBe('2026-08');
  });

  it('rolls the year over at both boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('monthLabel / bangkokMonthRangeForKey', () => {
  it('labels a key the same way the range labels its month', () => {
    // Thai locale renders the Buddhist year (2569 = 2026 CE).
    expect(monthLabel('2026-07')).toBe('กรกฎาคม 2569');
  });

  it('resolves a key to that Bangkok month window', () => {
    const range = bangkokMonthRangeForKey('2026-07');
    expect(range.key).toBe('2026-07');
    // Month starts at 2026-06-30 17:00 UTC (2026-07-01 00:00 Bangkok).
    expect(range.from.toISOString()).toBe('2026-06-30T17:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-07-31T17:00:00.000Z');
  });
});
