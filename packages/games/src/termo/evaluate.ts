import { normalizeWord } from "./normalize";

export type TileState = "correct" | "present" | "absent";

export type TileStates = readonly [
  TileState,
  TileState,
  TileState,
  TileState,
  TileState,
];

export const WORD_LENGTH = 5;

// Built from WORD_LENGTH so the shape check and the RangeError message that
// interpolates WORD_LENGTH can never disagree.
const SHAPE = new RegExp(`^[a-z]{${String(WORD_LENGTH)}}$`);

/**
 * Evaluate a guess against an answer, Termo-style. Accent-insensitive: both
 * inputs are passed through normalizeWord internally. After normalization
 * each must match ^[a-z]{5}$ or a RangeError is thrown. Does NOT check
 * dictionary membership — that is isValidGuess's job; keeping evaluation
 * total over shaped strings keeps the engine testable with synthetic
 * fixtures.
 *
 * Standard two-pass algorithm with letter-count accounting over the
 * normalized forms: pass 1 marks exact matches and consumes counts; pass 2
 * walks left-to-right marking present while counts remain, absent otherwise.
 */
export function evaluateGuess(guess: string, answer: string): TileStates {
  const g = normalizeWord(guess);
  const a = normalizeWord(answer);
  if (!SHAPE.test(g)) {
    throw new RangeError(
      `guess must normalize to exactly ${String(WORD_LENGTH)} letters a-z, got ${JSON.stringify(guess)}`,
    );
  }
  if (!SHAPE.test(a)) {
    throw new RangeError(
      `answer must normalize to exactly ${String(WORD_LENGTH)} letters a-z, got ${JSON.stringify(answer)}`,
    );
  }

  const remaining = new Map<string, number>();
  for (const letter of a) {
    remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  }

  const tiles: [TileState, TileState, TileState, TileState, TileState] = [
    "absent",
    "absent",
    "absent",
    "absent",
    "absent",
  ];

  // Pass 1: exact matches consume their letter's count first.
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    const letter = g.charAt(i);
    if (letter === a.charAt(i)) {
      tiles[i] = "correct";
      // The letter is present at this answer position, so its count is ≥ 1.
      remaining.set(letter, (remaining.get(letter) ?? 0) - 1);
    }
  }

  // Pass 2: non-correct positions, left-to-right, take present while the
  // letter's count lasts.
  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (tiles[i] === "correct") {
      continue;
    }
    const letter = g.charAt(i);
    const count = remaining.get(letter) ?? 0;
    if (count > 0) {
      tiles[i] = "present";
      remaining.set(letter, count - 1);
    }
  }

  return tiles;
}
