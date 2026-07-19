import type { Category, Direction } from '@/lib/types';

export interface ClassificationRequest {
  description: string;
  amount: number;
  /** The deterministic guess. When `directionLocked` is true, honour it. */
  direction: Direction;
  directionLocked: boolean;
}

export interface Classification {
  category: Category;
  direction: Direction;
}

/**
 * Kept narrow on purpose: the parsing engine depends on this interface, not on
 * any vendor SDK, so tests can pass a stub and the provider can be swapped.
 */
export interface AiClassifier {
  classify(req: ClassificationRequest): Promise<Classification | null>;
}

/** The raw fields an incoming email offers the extractor. */
export interface EmailForExtraction {
  subject: string;
  from: string;
  /** Plain-text body (or snippet). Held in memory only — never persisted (PDPA). */
  text: string;
}

/** What the extractor pulls out — enough to build a transaction draft. */
export interface ExtractedTransaction {
  amount: number;
  /** The merchant/counterparty, used as the transaction description. */
  merchant: string;
  direction: Direction;
}

/**
 * Extraction is a different job from classification: it turns a bank/payment
 * email into transaction fields, and returns null when the email isn't a
 * transaction at all (OTPs, promotions) — that null path is the real filter, so
 * the sender query upstream doesn't have to be exhaustive.
 */
export interface EmailExtractor {
  extract(email: EmailForExtraction): Promise<ExtractedTransaction | null>;
}
