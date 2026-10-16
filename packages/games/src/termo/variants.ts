import { MAX_GUESSES } from "./status";

export const TERMO_VARIANTS = {
  classico: { boards: 1, maxGuesses: MAX_GUESSES },
  dueto: { boards: 2, maxGuesses: 7 },
  quarteto: { boards: 4, maxGuesses: 9 },
} as const;

export type TermoVariant = keyof typeof TERMO_VARIANTS;
