import { z } from "zod";

export const GAMES = ["binairo", "sudoku", "nonogram", "termo"] as const;

export type Game = (typeof GAMES)[number];

export const gameSchema = z.enum(GAMES);
