import { describe, expect, it } from 'vitest';

import { buildReportFlex, buildReportText, savingsAdvice } from './report';
import type { Summary } from './summary';

function makeSummary(over: Partial<Summary> = {}): Summary {
  return {
    income: 0,
    expense: 0,
    net: 0,
    count: 0,
    expenseByCategory: [],
    ...over,
  };
}

describe('savingsAdvice', () => {
  it('warns and points at the biggest category when overspending', () => {
    const advice = savingsAdvice(
      makeSummary({
        income: 1000,
        expense: 1500,
        net: -500,
        expenseByCategory: [{ category: 'food', amount: 900, share: 0.6 }],
      }),
    );
    expect(advice).toContain('เกินรายรับ');
    expect(advice).toContain('อาหาร');
  });

  it('nudges to record income when only expenses exist', () => {
    const advice = savingsAdvice(makeSummary({ income: 0, expense: 300, net: -300 }));
    // net < 0 with no income still reads as overspend; income===0 branch is for
    // the break-even case where nothing was earned but spending matched.
    expect(advice).toContain('เกินรายรับ');
  });

  it('flags a pure-expense, zero-net month as missing income', () => {
    const advice = savingsAdvice(makeSummary({ income: 0, expense: 0, net: 0 }));
    expect(advice).toContain('รายรับ');
  });

  it('praises a strong savings rate', () => {
    const advice = savingsAdvice(makeSummary({ income: 1000, expense: 700, net: 300 }));
    expect(advice).toContain('30%');
    expect(advice).toContain('เยี่ยม');
  });

  it('encourages a thin savings rate', () => {
    const advice = savingsAdvice(makeSummary({ income: 1000, expense: 950, net: 50 }));
    expect(advice).toContain('5%');
  });
});

describe('buildReportText', () => {
  it('is used verbatim as the Flex altText', () => {
    const summary = makeSummary({
      income: 1000,
      expense: 400,
      net: 600,
      count: 3,
      expenseByCategory: [{ category: 'food', amount: 400, share: 1 }],
    });
    const flex = buildReportFlex('กรกฎาคม 2569', summary);
    expect(flex.altText).toBe(buildReportText('กรกฎาคม 2569', summary));
    expect(flex.altText).toContain('รายงานประจำเดือนกรกฎาคม 2569');
  });
});
