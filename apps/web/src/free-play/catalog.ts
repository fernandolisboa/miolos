import type { Game } from "@miolos/core";
import type { Weekday } from "@miolos/games";

import { messages, routes } from "../i18n";
import type { PlayChromeBack } from "../play/screen-chrome";

export const FREE_PLAY_GAMES = [
  "binairo",
  "sudoku",
  "nonogram",
  "termo",
  "crossword",
  "queens",
] as const satisfies readonly Game[];

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

export const FREE_PLAY_BACK: PlayChromeBack = {
  href: routes.freePlay,
  label: messages.freePlay.back,
  ariaLabel: messages.freePlay.backToIndexAria,
};
