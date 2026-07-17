import { GoogleGenAI, Type } from '@google/genai';

import { env } from '@/lib/env';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isCategoryFor,
  type Direction,
} from '@/lib/types';
import type { AiClassifier, Classification, ClassificationRequest } from './provider';

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    direction: { type: Type.STRING, enum: ['income', 'expense'] },
    category: { type: Type.STRING, enum: [...ALL_CATEGORIES] },
  },
  required: ['direction', 'category'],
} as const;

function buildPrompt(req: ClassificationRequest): string {
  const directionRule = req.directionLocked
    ? `The direction is already known to be "${req.direction}". Return exactly that.`
    : 'Decide whether this is income or an expense. Most entries are expenses.';

  return [
    'You classify personal finance entries written in Thai.',
    `Entry: "${req.description}" — amount ${req.amount} THB.`,
    directionRule,
    `Expense categories: ${EXPENSE_CATEGORIES.join(', ')}.`,
    `Income categories: ${INCOME_CATEGORIES.join(', ')}.`,
    'Pick the single best category matching the direction you return.',
  ].join('\n');
}

export class GeminiClassifier implements AiClassifier {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string = env.GEMINI_API_KEY, model: string = env.GEMINI_MODEL) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async classify(req: ClassificationRequest): Promise<Classification | null> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: buildPrompt(req),
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

    return coerceClassification(parsed, req);
  }
}

/**
 * The schema constrains the model, but a malformed response must never reach
 * the database — validate before trusting it.
 */
function coerceClassification(
  parsed: unknown,
  req: ClassificationRequest,
): Classification | null {
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { direction, category } = parsed as Record<string, unknown>;
  if (typeof category !== 'string') return null;

  const resolved: Direction = req.directionLocked
    ? req.direction
    : direction === 'income' || direction === 'expense'
      ? direction
      : req.direction;

  if (!isCategoryFor(resolved, category)) return null;

  return { direction: resolved, category };
}
