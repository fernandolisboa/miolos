export { normalizeWord } from "../normalize";
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
  judgeBoards,
  type JudgedBoard,
  type JudgedBoards,
} from "./judge-boards";
export { TERMO_VARIANTS, type TermoVariant } from "./variants";
export {
  isProfanityForm,
  isValidGuess,
  TERMO_VALIDATION_WORDS,
} from "./word-list";
