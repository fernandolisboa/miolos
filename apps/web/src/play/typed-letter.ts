import { normalizeWord } from "@miolos/games/termo";

const SINGLE_LETTER = /^[a-z]$/;

export function typedLetter(key: string): string | null {
  const letter = normalizeWord(key);
  return SINGLE_LETTER.test(letter) ? letter : null;
}
