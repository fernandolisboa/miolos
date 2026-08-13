/**
 * The free-play catalog (ADR-0046): which games free play offers, the
 * three-level difficulty vocabulary, and the seed source. Pure values —
 * no React, no fetch, nothing here may reach the daily's sync/record
 * machinery (the ESLint wall around this directory enforces it).
 */
import type { Game } from "@miolos/core";
import type { Weekday } from "@miolos/games";

/**
 * The grid games. Termo is excluded by PROJECT INVARIANT (CLAUDE.md;
 * ADR-0005: its answer list is finite curated content and free play
 * would burn it). The `satisfies` clause makes adding it a type error.
 */
export const FREE_PLAY_GAMES = [
  "binairo",
  "sudoku",
  "nonogram",
] as const satisfies readonly Exclude<Game, "termo">[];

export type FreePlayGame = (typeof FREE_PLAY_GAMES)[number];

export const FREE_PLAY_LEVELS = ["leve", "medio", "dificil"] as const;
export type FreePlayLevel = (typeof FREE_PLAY_LEVELS)[number];

/** Every screen starts here (ADR-0046 decision 2). */
export const DEFAULT_FREE_PLAY_LEVEL: FreePlayLevel = "medio";

/**
 * ADR-0046: the ramp's endpoints and middle (plan 025 D2). The weekday IS
 * the engines' difficulty axis — Monday easiest through Sunday hardest in
 * all three grid games — and free play maps its three levels onto 1/4/7
 * for the widest legible spread.
 */
export const LEVEL_WEEKDAYS: Readonly<Record<FreePlayLevel, Weekday>> = {
  leve: 1,
  medio: 4,
  dificil: 7,
};

/**
 * One uint32 from the platform CSPRNG — the client picks the seed
 * (ADR-0011). Never `Math.random()`: determinism-bearing randomness in
 * this codebase flows from named sources.
 */
export function pickSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  // noUncheckedIndexedAccess (tsconfig.base.json) types buffer[0] as
  // number | undefined; index 0 of a length-1 typed array always exists,
  // so the fallback is unreachable and only keeps the type honest.
  return buffer[0] ?? 0;
}

/**
 * The date field the daily-shaped inits require. In free play it is
 * rendered nowhere, keys no storage (ADR-0046 decision 4: a session is
 * ephemeral) and reaches no wire — a named sentinel is honest about being
 * inert, where a real-looking date would invite someone to read it.
 */
export const FREE_PLAY_DATE = "1970-01-01";
