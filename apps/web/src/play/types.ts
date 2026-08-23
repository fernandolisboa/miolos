import type { PlayRecord } from "./play-record";
import type { TimerState } from "./timer";

export interface PlayCore {
  /** The SERVER's date for this puzzle — never a client-computed today. */
  readonly date: string;
  readonly timer: TimerState;
  readonly status: "playing" | "solved" | "lost";
  readonly pendingSync: boolean;
  /**
   * The clock reference the readouts render against, moved by `tick`,
   * `pause`, `resume` and `restore`. It lives in state precisely so no
   * component reads `Date.now()` during render; `0` in the server snapshot
   * makes the first paint deterministic.
   */
  readonly now: number;
  /** false until the mount effect has run. Gates every record-derived render. */
  readonly hydrated: boolean;
}

/**
 * The one optional prop the four shared per-game `PlayView`/`PlaySkeleton`
 * components gain for the archive. **The prop budget is closed at one
 * optional member per view.**
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
   * stylesheet without any per-game view importing one from `src/archive/`.
   * It is NOT a general styling hook: one class, one sheet, one sentence.
   */
  readonly note: {
    readonly text: string;
    readonly className: string;
  };
}

export interface HintState {
  /** One free hint per puzzle. Not a balance, not a grant. */
  readonly free: 1;
  readonly used: number;
  /** The cell the hint filled, for the highlight. */
  readonly lastIndex: number | null;
}

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
 * PLAIN DATA ONLY — never a function, however tempting
 * (`test/route-ssr.test.tsx`).
 */
export interface ConclusionCopy {
  readonly title: string;
  readonly kicker: string;
  readonly notYet: {
    readonly title: string;
    readonly cta: string;
  };
}

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
 * The day's word in its canonical accented spelling.
 *
 * Supplied ONLY by a client component that owns the local play record. A
 * server segment must never compute it: `/termo/concluido` renders for
 * players who have NOT finished, and a server-computed word would turn a
 * bookmarkable page into the only spoiler channel this game has (ADR-0004,
 * ADR-0043 decision 7).
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
 * The solved picture, for the one game whose payoff is an image.
 *
 * Supplied ONLY by a client component that owns the local play record. A
 * server segment must never compute it: /<jogo>/concluido renders for
 * players who have NOT solved, and its RSC payload would become a spoiler
 * channel (ADR-0004, ADR-0033).
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
   * The motif's curated pt-BR name — "Âncora". Present only once the server
   * has published it on the user's own completed day claim, so its ABSENCE is
   * the ordinary case, not a defect: offline finish, pre-sync render, deploy
   * skew and a killed daily row all render without it.
   *
   * It arrives as DATA rather than being looked up downstream because
   * `<ConclusionView/>` is game-blind and may not import
   * `messages.games.nonogram.*`.
   */
  readonly name?: string;
  /**
   * The caption's kicker, beside `name` — "A figura de hoje era". Present
   * exactly when `name` is: a lead with nothing under it is a label for a
   * missing value.
   */
  readonly lead?: string;
}
