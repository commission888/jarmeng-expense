import { describe, expect, it } from 'vitest';

import { buildSyncQuery, extractPlainText, getHeader } from './api';

function b64url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url');
}

describe('buildSyncQuery', () => {
  it('bounds a never-synced account to a lookback window, not the whole mailbox', () => {
    const q = buildSyncQuery(null);
    expect(q).toMatch(/^from:\(.+\) after:\d{4}\/\d{2}\/\d{2}$/);
    expect(q).toContain('scb.co.th');
  });

  it('starts a day before the last sync so the boundary day is not missed', () => {
    // 2026-07-10 -> after:2026/07/09 (dedupe cleans the one-day overlap).
    expect(buildSyncQuery('2026-07-10T08:00:00.000Z')).toContain('after:2026/07/09');
  });
});

describe('extractPlainText', () => {
  it('decodes a flat text/plain body', () => {
    const part = { mimeType: 'text/plain', body: { data: b64url('ยอดใช้จ่าย 250 บาท') } };
    expect(extractPlainText(part)).toBe('ยอดใช้จ่าย 250 บาท');
  });

  it('finds the plain part nested inside multipart/alternative', () => {
    const part = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/html', body: { data: b64url('<p>ignore me</p>') } },
            { mimeType: 'text/plain', body: { data: b64url('the real body') } },
          ],
        },
      ],
    };
    expect(extractPlainText(part)).toBe('the real body');
  });

  it('returns empty when there is no plain part', () => {
    const part = { mimeType: 'text/html', body: { data: b64url('<p>html only</p>') } };
    expect(extractPlainText(part)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
  });
});

describe('getHeader', () => {
  const headers = [
    { name: 'Subject', value: 'แจ้งเตือนการใช้บัตร' },
    { name: 'From', value: 'SCB <no-reply@scb.co.th>' },
  ];

  it('matches case-insensitively', () => {
    expect(getHeader(headers, 'subject')).toBe('แจ้งเตือนการใช้บัตร');
    expect(getHeader(headers, 'FROM')).toBe('SCB <no-reply@scb.co.th>');
  });

  it('returns null for a missing header', () => {
    expect(getHeader(headers, 'Date')).toBeNull();
  });
});
