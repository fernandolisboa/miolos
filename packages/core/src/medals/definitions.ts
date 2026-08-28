import type { Game } from "../game";

export type MedalRule =
  | {
      readonly kind: "totalWins";
      readonly game: Game | null;
      readonly count: number;
    }
  | { readonly kind: "streakReached"; readonly days: number }
  | { readonly kind: "perfectDaysReached"; readonly count: number }
  | {
      readonly kind: "termoGuessWins";
      readonly guesses: 1 | 2 | 6;
      readonly count: number;
    }
  | { readonly kind: "eachGameWon" }
  | { readonly kind: "curated" };

export interface MedalDefinition {
  readonly id: string;
  readonly rule: MedalRule;
}

export const MEDAL_DEFINITIONS = [
  { id: "first-win", rule: { kind: "totalWins", game: null, count: 1 } },
  { id: "wins-10", rule: { kind: "totalWins", game: null, count: 10 } },
  { id: "wins-50", rule: { kind: "totalWins", game: null, count: 50 } },
  { id: "wins-100", rule: { kind: "totalWins", game: null, count: 100 } },
  { id: "wins-500", rule: { kind: "totalWins", game: null, count: 500 } },

  { id: "binairo-30", rule: { kind: "totalWins", game: "binairo", count: 30 } },
  { id: "sudoku-30", rule: { kind: "totalWins", game: "sudoku", count: 30 } },
  {
    id: "nonogram-30",
    rule: { kind: "totalWins", game: "nonogram", count: 30 },
  },
  { id: "termo-30", rule: { kind: "totalWins", game: "termo", count: 30 } },

  { id: "streak-3", rule: { kind: "streakReached", days: 3 } },
  { id: "streak-7", rule: { kind: "streakReached", days: 7 } },
  { id: "streak-30", rule: { kind: "streakReached", days: 30 } },
  { id: "streak-100", rule: { kind: "streakReached", days: 100 } },
  { id: "streak-365", rule: { kind: "streakReached", days: 365 } },

  { id: "perfect-1", rule: { kind: "perfectDaysReached", count: 1 } },
  { id: "perfect-5", rule: { kind: "perfectDaysReached", count: 5 } },
  { id: "perfect-10", rule: { kind: "perfectDaysReached", count: 10 } },
  { id: "perfect-30", rule: { kind: "perfectDaysReached", count: 30 } },

  {
    id: "termo-first-try",
    rule: { kind: "termoGuessWins", guesses: 1, count: 1 },
  },
  {
    id: "termo-in-two",
    rule: { kind: "termoGuessWins", guesses: 2, count: 10 },
  },
  {
    id: "termo-last-guess",
    rule: { kind: "termoGuessWins", guesses: 6, count: 1 },
  },

  { id: "all-games", rule: { kind: "eachGameWon" } },

  { id: "founder", rule: { kind: "curated" } },
] as const satisfies readonly MedalDefinition[];

export type MedalId = (typeof MEDAL_DEFINITIONS)[number]["id"];

export const MEDAL_IDS: readonly MedalId[] =
  /*#__PURE__*/ MEDAL_DEFINITIONS.map((d) => d.id);
