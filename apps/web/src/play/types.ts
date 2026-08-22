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

/**
 * The ONE optional prop the four shared per-game `PlayView`/`PlaySkeleton`
 * components gain for the archive (#31, ADR-0053 decision 9). Absent — every
 * daily route — the render is byte-identical to what shipped, and T-WEB-S185
 * pins that in both directions for all four games.
 *
 * **The prop budget is closed at one optional member per view**, stated here
 * the way ADR-0043 consequence (a) closes `ConclusionView`'s at two.
 *
 * **It lives in `src/play/`, not in `src/archive/`, and the direction is the
 * point** (step-6 F22). Four DAILY views consume this type; a type imported
 * by the daily layer out of the archive layer is the dependency arrow drawn
 * backwards, and it sat there only because plan 037 §1 exception (iii) capped
 * `src/play/` edits — a scope criterion deciding a module boundary. The
 * concrete builder stays in `src/archive/chrome.ts`, where it belongs.
 *
 * **There is no mode chip, and its absence is a decision.** Three things
 * already say "you are in the archive": the back link reads `← <the day>` and
 * leaves for the day page, the top bar renders the archived long date, and
 * the note states the semantics in a full sentence, which is the one thing a
 * chip saying "Arquivo" could never say.
 */
export interface ArchivePlayChrome {
  readonly back: {
    readonly href: string;
    readonly label: string;
    readonly ariaLabel: string;
  };
  /**
   * The note and the class that styles it. A CSS-module class name is a
   * string, so carrying it here is what lets the archive own its own
   * stylesheet without any per-game view importing one from `src/archive/`
   * (step-6 F10b). It is NOT a general styling hook: one class, one sheet,
   * one sentence.
   */
  readonly note: {
    readonly text: string;
    readonly className: string;
  };
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
 * The stamp Termo renders in place of the shared label/time/hints triple
 * (#27, ADR-0043). Plain data only, following `picture` exactly; supplied
 * ONLY by a client component that owns the local play record. A game that
 * passes nothing renders exactly what it rendered before this prop existed.
 *
 * `state` drives `data-conclusion-state`, so ONE prop serves both Termo
 * outcomes: a win is still "result", a loss is "lost". Termo passes it on
 * BOTH outcomes because neither of the shipped stamp's three slots is honest
 * here — there is no hint to have gone without (ADR-0045 decision 1), and the
 * elapsed time is dominated by the per-guess round trip (decision 4).
 *
 * THERE IS NO CONSOLATION FLOURISH on a loss: no second stamp design, no
 * mascot and no emoji. The loss equivalent of the celebration is the
 * celebration's absence — the settle animation simply does not run — and
 * stating that here is what stops the next contributor from inventing one.
 *
 * IT IS DERIVED FROM `state`, NOT CARRIED BESIDE IT. A `settle: boolean`
 * field lived here and every call site and every test paired `"lost"` with
 * `false` and `"result"` with `true`; the other two combinations were
 * unreachable and untested, and the TSDoc's motive for the field was an
 * explicitly hypothetical future game (finding B-11). That is the same shape
 * `messages.ts` rejects by name for `lostAria` — "a runtime branch on a
 * compile-time constant whose false arm is unreachable and untestable". A
 * game that genuinely wants a still `"result"` stamp adds the degree of
 * freedom then, with a caller that exercises it.
 *
 * `state` is the only field the day-state reader consults, and it does so to
 * decide whether the game being celebrated enters the day card as *completed*
 * or as *played* (plan 022 §15.3). `label`, `detail` and `aria` are the
 * stamp's own, rendered by the conclusion's fourth branch.
 */
export interface ConclusionOutcome {
  readonly state: "result" | "lost";
  /** "Concluído" | "Jogado" — composed by the caller from its own bundle. */
  readonly label: string;
  /** "4/6" | "X/6". */
  readonly detail: string;
  /** The whole composed accessible name (ADR-0018). */
  readonly aria: string;
}

/**
 * The day's word in its canonical accented spelling (#27 AC 2, ADR-0043
 * decision 6). Three plain strings; nothing here is a function, and nothing
 * here is composed in the component that renders it.
 *
 * Rendered on BOTH Termo outcomes. On a win it is not redundant: the player
 * typed the word accent-free, so the accents are the one thing they have not
 * seen.
 *
 * Supplied ONLY by a client component that owns the local play record, on
 * `picture`'s rule exactly. A server segment must never compute it:
 * `/termo/concluido` renders for players who have NOT finished, and a
 * server-computed word would turn a bookmarkable page into the only spoiler
 * channel this game has (ADR-0004, ADR-0034 decision 3, ADR-0043 decision 7).
 */
export interface ConclusionAnswer {
  /** "Você acertou em 4 de 6 tentativas." | "As 6 tentativas acabaram." */
  readonly result: string;
  /** "A palavra de hoje era". */
  readonly lead: string;
  /** The accented spelling — "café". */
  readonly canonical: string;
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
  /**
   * The motif's curated pt-BR name (#64, ADR-0070) — "Âncora". Present only
   * once the server has published it on the user's own completed day claim,
   * so its ABSENCE is the ordinary case, not a defect: offline finish,
   * pre-sync render, deploy skew and a killed daily row all render exactly
   * what shipped before #64.
   *
   * It arrives as DATA rather than being looked up downstream, which is the
   * whole reason it is here: `<ConclusionView/>` is game-blind and may not
   * import `messages.games.nonogram.*`. Termo's `ConclusionAnswer`
   * `{result, lead, canonical}` is the shipped precedent for the shape.
   */
  readonly name?: string;
  /**
   * The caption's kicker, beside `name` and travelling with it for the same
   * reason — "A figura de hoje era". Present exactly when `name` is: a lead
   * with nothing under it is a label for a missing value.
   *
   * It is a SECOND field on this member rather than a second member on
   * `ConclusionSummary`, which keeps ADR-0034 consequence (c)'s one-payoff-
   * member-per-game budget intact.
   */
  readonly lead?: string;
}
