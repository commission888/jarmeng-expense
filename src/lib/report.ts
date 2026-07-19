import type { messagingApi } from '@line/bot-sdk';

import { categoryLabel, formatBaht } from '@/lib/format';
import type { Summary } from '@/lib/summary';

/**
 * The "แนะนำการออมอัจฉริยะ" line the PRD asks for. Kept pure so it reads the
 * same numbers the report shows and can be unit-tested without the LINE SDK.
 * Savings rate is measured against income, not expense — a month with no income
 * recorded gets its own nudge rather than a misleading percentage.
 */
export function savingsAdvice(summary: Summary): string {
  const { income, expense, net } = summary;

  if (net < 0) {
    const top = summary.expenseByCategory[0];
    const hint = top
      ? `หมวดที่ใช้มากสุดคือ${categoryLabel(top.category)} (${formatBaht(top.amount)}) ลองลดตรงนี้ดูครับ`
      : 'ลองทบทวนรายจ่ายที่ไม่จำเป็นดูครับ';
    return `⚠️ เดือนนี้ใช้จ่ายเกินรายรับ ${formatBaht(Math.abs(net))} — ${hint}`;
  }

  if (income === 0) {
    return `บันทึกแต่รายจ่าย ${formatBaht(expense)} เดือนนี้ — อย่าลืมบันทึกรายรับด้วยนะครับ จะได้เห็นภาพรวมชัดขึ้น`;
  }

  const pct = Math.round((net / income) * 100);

  if (pct >= 20) {
    return `🎉 เยี่ยมมาก! เดือนนี้ออมได้ ${pct}% ของรายรับ (${formatBaht(net)}) รักษาวินัยแบบนี้ไว้นะครับ`;
  }
  if (pct >= 10) {
    return `👍 เดือนนี้ออมได้ ${pct}% ของรายรับ (${formatBaht(net)}) ดันให้ถึง 20% จะยิ่งดีครับ`;
  }
  return `💡 เดือนนี้เหลือเก็บ ${formatBaht(net)} (${pct}% ของรายรับ) ลองตั้งเป้าออมสัก 10–20% ดูครับ`;
}

/**
 * Plain-text form of the report. Doubles as the Flex `altText` (what shows in
 * the push notification and on clients that can't render Flex).
 */
export function buildReportText(label: string, summary: Summary): string {
  const top = summary.expenseByCategory
    .slice(0, 5)
    .map((c) => `• ${categoryLabel(c.category)} — ${formatBaht(c.amount)} (${Math.round(c.share * 100)}%)`);

  return [
    `📊 รายงานประจำเดือน${label}`,
    '',
    `📥 รายรับ: ${formatBaht(summary.income)}`,
    `📤 รายจ่าย: ${formatBaht(summary.expense)}`,
    `${summary.net >= 0 ? '💰 คงเหลือ' : '⚠️ ติดลบ'}: ${formatBaht(Math.abs(summary.net))}`,
    '',
    ...(top.length ? ['หมวดที่ใช้มากที่สุด:', ...top, ''] : []),
    savingsAdvice(summary),
  ].join('\n');
}

const ACCENT = '#06C755'; // LINE green
const MUTED = '#8C8C8C';

function statRow(label: string, value: string, color?: string): messagingApi.FlexBox {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: MUTED, flex: 0 },
      { type: 'text', text: value, size: 'sm', align: 'end', color, weight: 'bold' },
    ],
  };
}

/**
 * The Flex bubble pushed to each user. `altText` is mandatory and reuses the
 * text form so nothing has to be worded twice.
 */
export function buildReportFlex(label: string, summary: Summary): messagingApi.FlexMessage {
  const categoryRows: messagingApi.FlexBox[] = summary.expenseByCategory
    .slice(0, 5)
    .map((c) =>
      statRow(
        `${categoryLabel(c.category)} · ${Math.round(c.share * 100)}%`,
        formatBaht(c.amount),
      ),
    );

  const netPositive = summary.net >= 0;

  return {
    type: 'flex',
    altText: buildReportText(label, summary),
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: ACCENT,
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: 'รายงานประจำเดือน', size: 'xs', color: '#FFFFFF' },
          { type: 'text', text: label, size: 'lg', weight: 'bold', color: '#FFFFFF' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          statRow('📥 รายรับ', formatBaht(summary.income)),
          statRow('📤 รายจ่าย', formatBaht(summary.expense)),
          statRow(
            netPositive ? '💰 คงเหลือ' : '⚠️ ติดลบ',
            formatBaht(Math.abs(summary.net)),
            netPositive ? ACCENT : '#E03131',
          ),
          ...(categoryRows.length
            ? [
                { type: 'separator' as const, margin: 'md' as const },
                {
                  type: 'text' as const,
                  text: 'หมวดที่ใช้มากที่สุด',
                  size: 'xs' as const,
                  color: MUTED,
                  margin: 'md' as const,
                },
                ...categoryRows,
              ]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: savingsAdvice(summary), size: 'sm', wrap: true, color: '#333333' },
        ],
      },
    },
  };
}
