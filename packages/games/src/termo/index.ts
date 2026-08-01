/**
 * Public API of @miolos/games/termo (per the games module-boundary
 * convention, ADR pending with #16). The sole ingestion path for the Termo
 * word list: #27's daily selection indexes TERMO_ANSWERS and never reads
 * content/termo directly.
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
