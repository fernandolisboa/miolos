export type CrosswordDirection = "across" | "down";

export interface CrosswordLexiconEntry {
  readonly normalized: string;
  readonly canonical: string;
  readonly clue: string;
}

export interface CrosswordSlot {
  readonly number: number;
  readonly direction: CrosswordDirection;
  readonly row: number;
  readonly col: number;
  readonly length: number;
}

export interface CrosswordEntry extends CrosswordLexiconEntry {
  readonly number: number;
  readonly direction: CrosswordDirection;
  readonly row: number;
  readonly col: number;
}

export type CrosswordGrid = ReadonlyArray<ReadonlyArray<string | null>>;

export interface CrosswordPuzzle {
  readonly seed: number;
  readonly grid: CrosswordGrid;
  readonly entries: ReadonlyArray<CrosswordEntry>;
}

export type CrosswordRejectionReason =
  | "grid-shape"
  | "entries-mismatch"
  | "entry-too-short"
  | "unchecked-cell"
  | "letters-mismatch"
  | "not-in-lexicon"
  | "duplicate-word";

export interface CrosswordValidationResult {
  readonly ok: boolean;
  readonly failures: ReadonlyArray<CrosswordRejectionReason>;
}

export class CrosswordGenerationError extends Error {
  readonly seed: number;
  readonly attempts: number;

  constructor(seed: number, attempts: number) {
    super(
      `crossword generation failed for seed ${String(seed)} after ${String(attempts)} attempts`,
    );
    this.name = "CrosswordGenerationError";
    this.seed = seed;
    this.attempts = attempts;
  }
}
