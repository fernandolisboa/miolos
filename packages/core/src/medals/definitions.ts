/**
 * The medal catalog (ADR-0052). Copy lives web-side in `medalCopy`
 * (ADR-0018) — this module carries only ids and rules.
 *
 * `MedalRule` is deliberately closed and narrow: `hintsUsed`, `elapsedMs`,
 * time-of-day, device state and free play are structurally inexpressible —
 * no variant has a field that could carry them.
 *
 * Ids are wire values and grant keys (`medal_grants.medal_id`): stable
 * forever once shipped. Renaming copy is free; renaming an id is a
 * migration of user data and is forbidden.
 */
import type { Game } from "../game";

export type MedalRule =
  | {
      readonly kind: "totalWins";
      readonly game: Game | null;
      readonly count: number;
    } // late wins count (ADR-0008 rule 2 names distributions, not totals)
  | { readonly kind: "streakReached"; readonly days: number } // computeStreak reuse, never re-derived
  | { readonly kind: "perfectDaysReached"; readonly count: number }
  | {
      readonly kind: "termoGuessWins";
      readonly guesses: 1 | 2 | 6;
      readonly count: number;
    } // on-time won termo rows only (the distribution-class honesty)
  | { readonly kind: "eachGameWon" }
  | { readonly kind: "curated" }; // earned via medal_grants rows only

export interface MedalDefinition {
  readonly id: string; // literal-typed via the const catalog
  readonly rule: MedalRule;
}

/** Catalog order is display order — there is no wire date to sort by. */
export const MEDAL_DEFINITIONS = [
  // totalWins, all games (late wins included — a late solve is honestly a
  // solve): 1, 10, 50, 100, 500.
  { id: "first-win", rule: { kind: "totalWins", game: null, count: 1 } },
  { id: "wins-10", rule: { kind: "totalWins", game: null, count: 10 } },
  { id: "wins-50", rule: { kind: "totalWins", game: null, count: 50 } },
  { id: "wins-100", rule: { kind: "totalWins", game: null, count: 100 } },
  { id: "wins-500", rule: { kind: "totalWins", game: null, count: 500 } },
  // totalWins, per game: the same round 30 for each of the four — parity,
  // no favourite.
  { id: "binairo-30", rule: { kind: "totalWins", game: "binairo", count: 30 } },
  { id: "sudoku-30", rule: { kind: "totalWins", game: "sudoku", count: 30 } },
  {
    id: "nonogram-30",
    rule: { kind: "totalWins", game: "nonogram", count: 30 },
  },
  { id: "termo-30", rule: { kind: "totalWins", game: "termo", count: 30 } },
  // streakReached (monotone by construction — reached once, earned
  // forever): 3, 7, 30, 100, 365.
  { id: "streak-3", rule: { kind: "streakReached", days: 3 } },
  { id: "streak-7", rule: { kind: "streakReached", days: 7 } },
  { id: "streak-30", rule: { kind: "streakReached", days: 30 } },
  { id: "streak-100", rule: { kind: "streakReached", days: 100 } },
  { id: "streak-365", rule: { kind: "streakReached", days: 365 } },
  // perfectDaysReached (counts only — no run-length over perfect days
  // exists or can be expressed): 1, 5, 10, 30.
  { id: "perfect-1", rule: { kind: "perfectDaysReached", count: 1 } },
  { id: "perfect-5", rule: { kind: "perfectDaysReached", count: 5 } },
  { id: "perfect-10", rule: { kind: "perfectDaysReached", count: 10 } },
  { id: "perfect-30", rule: { kind: "perfectDaysReached", count: 30 } },
  // termoGuessWins (guesses ∈ {1, 2, 6} only — the middle of the
  // distribution is not a feat): win-in-1 once, win-in-2 ten times,
  // win-in-6 (last-guess survival) once.
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
  // Breadth: every game won at least once (late included — volume class).
  { id: "all-games", rule: { kind: "eachGameWon" } },
  // Curated: the founder grant. This definition must ship before the
  // one-shot grant insert — an id with no matching definition is silently
  // dropped, never an error.
  { id: "founder", rule: { kind: "curated" } },
] as const satisfies readonly MedalDefinition[];

export type MedalId = (typeof MEDAL_DEFINITIONS)[number]["id"];

// /*#__PURE__*/ is load-bearing, not tidiness (the word-list.ts precedent):
// a module-level call is otherwise a side effect that can pin the module
// into chunks that only wanted a type. The annotation is fragile and
// invisible to the gates (route-client-js.mjs records exactly that), so the
// PR's measured bundle figures remain the real check.
export const MEDAL_IDS: readonly MedalId[] =
  /*#__PURE__*/ MEDAL_DEFINITIONS.map((d) => d.id);
