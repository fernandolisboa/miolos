import type { Game } from "@miolos/core";
import type { Weekday } from "@miolos/games";

export const FREE_PLAY_GAMES = [
  "binairo",
  "sudoku",
  "nonogram",
] as const satisfies readonly Exclude<Game, "termo">[];

export type FreePlayGame = (typeof FREE_PLAY_GAMES)[number];

export const FREE_PLAY_LEVELS = ["leve", "medio", "dificil"] as const;
export type FreePlayLevel = (typeof FREE_PLAY_LEVELS)[number];

export const DEFAULT_FREE_PLAY_LEVEL: FreePlayLevel = "medio";

export const LEVEL_WEEKDAYS: Readonly<Record<FreePlayLevel, Weekday>> = {
  leve: 1,
  medio: 4,
  dificil: 7,
};

export function pickSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);

  return buffer[0] ?? 0;
}

export const FREE_PLAY_DATE = "1970-01-01";
