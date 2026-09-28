import { normalizeWord } from "@miolos/games";

const SINGLE_LETTER = /^[a-z]$/;

export function typedLetter(key: string): string | null {
  const letter = normalizeWord(key);
  return SINGLE_LETTER.test(letter) ? letter : null;
}
