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

const SHAPE = new RegExp(`^[a-z]{${String(WORD_LENGTH)}}$`);

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

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    const letter = g.charAt(i);
    if (letter === a.charAt(i)) {
      tiles[i] = "correct";

      remaining.set(letter, (remaining.get(letter) ?? 0) - 1);
    }
  }

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
