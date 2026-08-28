import { type TileState, type TileStates } from "./evaluate";
import { normalizeWord } from "./normalize";

export interface EvaluatedGuess {
  readonly guess: string;
  readonly tiles: TileStates;
}

export type KeyboardState = Readonly<Partial<Record<string, TileState>>>;

const PRECEDENCE: Record<TileState, number> = {
  correct: 2,
  present: 1,
  absent: 0,
};

export function deriveKeyboardState(
  guesses: readonly EvaluatedGuess[],
): KeyboardState {
  const state: Partial<Record<string, TileState>> = {};
  for (const { guess, tiles } of guesses) {
    const normalized = normalizeWord(guess);
    for (let i = 0; i < tiles.length; i += 1) {
      const letter = normalized.charAt(i);
      const tile = tiles[i];
      if (letter === "" || tile === undefined) {
        continue;
      }
      const current = state[letter];
      if (current === undefined || PRECEDENCE[tile] > PRECEDENCE[current]) {
        state[letter] = tile;
      }
    }
  }
  return state;
}
