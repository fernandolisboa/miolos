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
