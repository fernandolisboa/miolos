import { z } from "zod";

export const GAMES = [
  "binairo",
  "sudoku",
  "nonogram",
  "termo",
  "crossword",
] as const;

export type Game = (typeof GAMES)[number];

export const gameSchema = z.enum(GAMES);

export function recordFor<K extends string, V>(
  keys: readonly K[],
  value: (key: K) => V,
): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<
    K,
    V
  >;
}
