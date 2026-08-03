/**
 * Public API of @miolos/games/termo, per the games module-boundary
 * convention — ADR-0019 (`docs/adr/0019-per-game-subpath-exports-in-packages-games.md`),
 * which landed with #16 and is the convention this file follows (an earlier
 * version of this sentence said "ADR pending with #16").
 *
 * The sole ingestion path for the Termo word list: #27's daily selection
 * DRAWS from TERMO_ANSWERS — uniformly at random over a run-scoped filtered
 * pool, never by indexing a seed into it (see `word-list.ts`) — and never
 * reads content/termo directly.
 */
export { normalizeWord } from "./normalize";
export {
  evaluateGuess,
  WORD_LENGTH,
  type TileState,
  type TileStates,
} from "./evaluate";
export {
  deriveKeyboardState,
  type EvaluatedGuess,
  type KeyboardState,
} from "./keyboard";
export {
  deriveBoardStatus,
  MAX_GUESSES,
  type TermoBoardStatus,
} from "./status";
export {
  isValidGuess,
  TERMO_ANSWERS,
  TERMO_VALIDATION_WORDS,
  type TermoAnswer,
} from "./word-list";
