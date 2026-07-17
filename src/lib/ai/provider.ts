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
