import fc from "fast-check";

export const PTBR_ALPHABET = "abcdefghijklmnopqrstuvwxyzáéíóúâêôãõàç";
export const AZ_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export const ptbrWord = fc.string({
  unit: fc.constantFrom(...PTBR_ALPHABET),
  minLength: 5,
  maxLength: 5,
});

export const azWord = fc.string({
  unit: fc.constantFrom(...AZ_ALPHABET),
  minLength: 5,
  maxLength: 5,
});
