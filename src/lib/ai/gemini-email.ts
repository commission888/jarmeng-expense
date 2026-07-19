import { GoogleGenAI, Type } from '@google/genai';

import { env } from '@/lib/env';
import type {
  EmailExtractor,
  EmailForExtraction,
  ExtractedTransaction,
} from './provider';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    // Gated first: false means OTP / promotion / statement summary — not a txn.
    isTransaction: { type: Type.BOOLEAN },
    amount: { type: Type.NUMBER },
    merchant: { type: Type.STRING },
    direction: { type: Type.STRING, enum: ['income', 'expense'] },
  },
  required: ['isTransaction'],
} as const;

function buildPrompt(email: EmailForExtraction): string {
  return [
    'You read Thai bank and payment notification emails and extract the single',
    'transaction each one reports.',
    '',
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    'Body:',
    // Bound the body so a long marketing email can't blow the token budget.
    email.text.slice(0, 4000),
    '',
    'If this email is NOT a completed money movement — e.g. an OTP, a promotion,',
    'a statement summary, or a login alert — set isTransaction to false and stop.',
    'Otherwise set isTransaction true and return:',
    '- amount: the transaction amount in THB, as a number (no currency symbol).',
    '- merchant: the shop or counterparty name, in its original language.',
    '- direction: "expense" when money left the account (a purchase, a payment,',
    '  a debit), "income" when money came in (a transfer received, a refund).',
  ].join('\n');
}

export class GeminiEmailExtractor implements EmailExtractor {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string = env.GEMINI_API_KEY, model: string = env.GEMINI_MODEL) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async extract(email: EmailForExtraction): Promise<ExtractedTransaction | null> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: buildPrompt(email),
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    });

    const text = response.text;
    if (!text) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    return coerceExtraction(parsed);
  }
}

/**
 * Validates the model's JSON before it can reach the database. Returns null for
 * a non-transaction or any malformed/implausible field — a bad extraction must
 * never become a bogus transaction.
 */
export function coerceExtraction(parsed: unknown): ExtractedTransaction | null {
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { isTransaction, amount, merchant, direction } = parsed as Record<string, unknown>;

  if (isTransaction !== true) return null;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  if (direction !== 'income' && direction !== 'expense') return null;

  const name = typeof merchant === 'string' ? merchant.trim() : '';

  return {
    amount,
    merchant: name || 'ไม่ระบุ',
    direction,
  };
}
