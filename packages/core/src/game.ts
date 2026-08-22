import { z } from "zod";

/**
 * Canonical game vocabulary (CONTEXT.md terms). All four games exist from
 * day one so the daily_puzzles schema and the daily contracts never
 * migrate when a later game ships.
 */
export const GAMES = ["binairo", "sudoku", "nonogram", "termo"] as const;

export type Game = (typeof GAMES)[number];

export const gameSchema = z.enum(GAMES);
