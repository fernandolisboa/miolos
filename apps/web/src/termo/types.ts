import type { TermoBoardStatus, TileStates } from "@miolos/games/termo";

import type { LifecycleAction, PlayCore } from "../play/types";
import type { HeldReason } from "./guess-client";

export interface TermoJudgedRow {
  readonly guess: string;
  readonly tiles: TileStates;
}

export interface TermoPlayState extends PlayCore {
  readonly guesses: readonly TermoJudgedRow[];
  readonly draft: string;
  readonly pending: string | null;
  readonly notice: string | null;
  readonly noticeNonce: number;
  readonly held: boolean;
  readonly announcement: string;
  readonly answer: string | undefined;
  readonly gone: boolean;
}

export type TermoPlayAction =
  | LifecycleAction
  | { readonly type: "type"; readonly letter: string }
  | { readonly type: "erase" }
  | { readonly type: "submit" }
  | { readonly type: "retry" }
  | { readonly type: "held"; readonly reason: HeldReason }
  | { readonly type: "gone" }
  | {
      readonly type: "rejected";
      readonly reason: "not-in-list" | "refused";
    }
  | {
      readonly type: "judged";
      readonly guess: string;
      readonly tiles: TileStates;
      readonly status: TermoBoardStatus;
      readonly answer: string | undefined;
    };
