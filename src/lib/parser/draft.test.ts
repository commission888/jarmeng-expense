import { describe, expect, it } from 'vitest';

import { extractDraft, keywordKey } from './draft';

describe('extractDraft', () => {
  it('pulls amount and description out of a plain expense', () => {
    expect(extractDraft('กาแฟ 50 บาท')).toEqual({
      amount: 50,
      description: 'กาแฟ',
      direction: 'expense',
      directionExplicit: false,
    });
  });

  it('treats an unmarked message as an expense, but not explicitly', () => {
    const draft = extractDraft('กาแฟ 50');
    expect(draft?.direction).toBe('expense');
    expect(draft?.directionExplicit).toBe(false);
  });

  it('reads thousands separators and decimals', () => {
    expect(extractDraft('ค่าเช่า 12,500.50 บาท')?.amount).toBe(12500.5);
  });

  it('expands the k suffix', () => {
    expect(extractDraft('โน้ตบุ๊ก 1.5k')?.amount).toBe(1500);
  });

  it('prefers the number carrying a currency marker', () => {
    const draft = extractDraft('กาแฟ 2 แก้ว 100 บาท');
    expect(draft?.amount).toBe(100);
  });

  it('falls back to the last number when nothing is marked', () => {
    expect(extractDraft('ข้าว 2 จาน 80')?.amount).toBe(80);
  });

  it('detects income from a leading plus', () => {
    const draft = extractDraft('+30000 ฟรีแลนซ์');
    expect(draft).toMatchObject({
      amount: 30000,
      direction: 'income',
      directionExplicit: true,
      description: 'ฟรีแลนซ์',
    });
  });

  it('detects income from Thai keywords', () => {
    expect(extractDraft('เงินเดือน 45000')).toMatchObject({
      direction: 'income',
      directionExplicit: true,
    });
  });

  it('marks expense explicitly when the text says so', () => {
    expect(extractDraft('จ่ายค่าน้ำ 300')).toMatchObject({
      direction: 'expense',
      directionExplicit: true,
    });
  });

  it('handles a currency prefix', () => {
    expect(extractDraft('฿250 ข้าวเย็น')?.amount).toBe(250);
  });

  it('returns null when there is no amount', () => {
    expect(extractDraft('สวัสดีครับ')).toBeNull();
    expect(extractDraft('')).toBeNull();
  });

  it('rejects a zero amount', () => {
    expect(extractDraft('กาแฟ 0 บาท')).toBeNull();
  });
});

describe('keywordKey', () => {
  it('normalizes casing and spacing so writes and reads agree', () => {
    expect(keywordKey('  Starbucks   Coffee ')).toBe('starbucks coffee');
  });
});
