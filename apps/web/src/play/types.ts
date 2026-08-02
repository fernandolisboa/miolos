/**
 * The vocabulary the shared daily-play layer is written against (ADR-0029,
 * plan 018 §5.4). Types only — every value that operates on them lives in
 * `timer.ts`, `progress.ts`, `grid-hint.ts` or `use-play-lifecycle.ts`.
 *
 * There is deliberately NO shared `PlayCopy`: the per-game `play` copy
 * bundles are structurally different by construction (Binairo's carries
 * sticky-mode button copy, Sudoku's carries a keypad and a difficulty
 * ladder), and unifying them behind one type would be the shallow
 * abstraction plan 018 S2 rejects for components. Only the conclusion's
 * copy is unified, below.
 */
import type { PlayRecord } from "./play-record";
import type { TimerState } from "./timer";

/** The lifecycle-relevant slice both reducers' states expose. */
export interface PlayCore {
  /** The SERVER's date for this puzzle — never a client-computed today. */
  readonly date: string;
  readonly timer: TimerState;
  /**
   * The lifecycle's terminal predicate is `status !== "playing"` — "the game
   * is CLOSED", never "the grid is solved". `lost` is carried here from the
   * start because Termo (#27) has a second terminal state (six guesses
   * exhausted, ADR-0008 keeps `lost` Termo-only): under a
   * `"playing" | "solved"` union a Termo loss would never freeze the clock,
   * never write the completion and never leave the play view. Binairo and
   * Sudoku narrow this to `"playing" | "solved"` in their own state types;
   * neither gets more complex.
   */
  readonly status: "playing" | "solved" | "lost";
  readonly pendingSync: boolean;
  /**
   * The clock reference the readouts render against, moved by `tick`,
   * `pause`, `resume` and `restore`. It lives in state precisely so no
   * component reads `Date.now()` during render (plan 017 D28); `0` in the
   * server snapshot makes the first paint deterministic.
   */
  readonly now: number;
  /** false until the mount effect has run. Gates every record-derived render. */
  readonly hydrated: boolean;
}

export interface HintState {
  /** One free hint per puzzle (plan 017 D21). Not a balance, not a grant. */
  readonly free: 1;
  readonly used: number;
  /** The cell the hint filled, for the highlight. */
  readonly lastIndex: number | null;
}

/**
 * The actions `usePlayLifecycle` dispatches. Both games' own action unions
 * include them, so the hook's `reduce` input is the game's real reducer
 * rather than a private copy of it.
 */
export type LifecycleAction =
  | {
      readonly type: "restore";
      readonly record: PlayRecord | undefined;
      readonly now: number;
    }
  | { readonly type: "tick"; readonly now: number }
  | { readonly type: "pause"; readonly now: number }
  | { readonly type: "resume"; readonly now: number };

/**
 * Exactly what `conclusion-view.tsx` reads off a game's own copy bundle —
 * i.e. `messages.games.<game>.conclusion`. Everything else the conclusion
 * renders comes from `messages.conclusion`, which is shared chrome and is
 * read from the module directly.
 *
 * PLAIN DATA ONLY — never a function, however tempting. This bundle is a
 * prop handed from the `/<jogo>/concluido` **server** page to
 * `<ConclusionView/>`, which is `"use client"`, so it crosses the RSC
 * boundary and React serializes it. A function member does not fail
 * typecheck, does not fail a component test that renders the view directly,
 * and throws "Functions cannot be passed directly to Client Components" the
 * first time the route is server-rendered — an HTTP 500 nothing but an SSR
 * test can see (`test/route-ssr.test.tsx`). Any string that needs a runtime
 * value is composed in `messages.conclusion`, which the client component
 * imports rather than receives.
 */
export interface ConclusionCopy {
  readonly title: string;
  readonly kicker: string;
  readonly notYet: {
    readonly title: string;
    readonly cta: string;
  };
}

/**
 * The solved picture, for the one game whose payoff is an image (ADR-0034).
 * Plain data across the RSC boundary: a row-major bitmap, its side, and a
 * pre-composed accessible name. Never a function, never a node — the same
 * constraint ConclusionCopy carries and route-ssr.test.tsx enforces.
 *
 * Supplied ONLY by a client component that owns the local play record. A
 * server segment must never compute it: /<jogo>/concluido renders for
 * players who have NOT solved, and its RSC payload would become a spoiler
 * channel (ADR-0004, ADR-0027's rejected list, ADR-0033).
 *
 * `size` is a plain `number`, not a game's size union: this type is
 * game-blind by construction and must not name one game's shape.
 */
export interface ConclusionPicture {
  readonly size: number;
  /** Row-major, length size²; 1 = filled. */
  readonly cells: readonly (0 | 1)[];
  /** Composed by the caller from its own i18n bundle. */
  readonly label: string;
}
