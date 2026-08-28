import type { PlayRecord } from "./play-record";
import type { TimerState } from "./timer";

export interface PlayCore {
  readonly date: string;
  readonly timer: TimerState;
  readonly status: "playing" | "solved" | "lost";
  readonly pendingSync: boolean;

  readonly now: number;

  readonly hydrated: boolean;
}

export interface ArchivePlayChrome {
  readonly back: {
    readonly href: string;
    readonly label: string;
    readonly ariaLabel: string;
  };

  readonly note: {
    readonly text: string;
    readonly className: string;
  };
}

export interface HintState {
  readonly free: 1;
  readonly used: number;

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

  readonly label: string;

  readonly detail: string;

  readonly aria: string;
}

export interface ConclusionAnswer {
  readonly result: string;

  readonly lead: string;

  readonly canonical: string;
}

export interface ConclusionPicture {
  readonly size: number;

  readonly cells: readonly (0 | 1)[];

  readonly label: string;

  readonly name?: string;

  readonly lead?: string;
}
