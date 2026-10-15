export const PICTURE_TONES = [
  "k",
  "e",
  "l",
  "n",
  "t",
  "r",
  "o",
  "y",
  "g",
  "d",
  "s",
  "b",
  "p",
  "m",
] as const;

export type MotifTones = Readonly<Record<string, ReadonlyArray<string>>>;
