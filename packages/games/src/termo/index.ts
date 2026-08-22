/**
 * Public API of @miolos/games/termo (ADR-0019 subpath). The sole ingestion
 * path for the Termo word list: the daily selection draws from
 * TERMO_ANSWERS uniformly at random over a run-scoped filtered pool, never
 * by indexing a seed into it, and never reads content/termo directly.
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
