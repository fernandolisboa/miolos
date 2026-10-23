import type {
  KeyboardState,
  TermoBoardStatus,
  TileStates,
} from "@miolos/games/termo";

import type { ReactNode } from "react";

import type {
  ArchivePlayChrome,
  LifecycleAction,
  PlayCore,
} from "../play/types";
import type { HeldReason } from "./guess-client";

export interface TermoJudgedRow {
  readonly guess: string;
  readonly tiles: TileStates;
}

export interface TermoPlayState extends PlayCore {
  readonly guesses: readonly TermoJudgedRow[];
  readonly draft: readonly string[];
  readonly cursor: number;
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
  | { readonly type: "select"; readonly slot: number }
  | { readonly type: "submit"; readonly acceptsProfanity: boolean }
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

export type TermoVerdict = Extract<
  TermoPlayAction,
  { readonly type: "judged" | "held" | "rejected" | "gone" }
>;

export type TermoJudge = (
  armed: TermoPlayState,
  guess: string,
) => TermoVerdict | Promise<TermoVerdict>;

export interface TermoPlay {
  readonly state: TermoPlayState;
  readonly used: number;
  readonly activeRow: number | null;
  readonly heldRow: number | null;
  readonly keyboardState: KeyboardState;
  readonly unavailable: boolean;
  readonly type: (letter: string) => void;
  readonly erase: () => void;
  readonly select: (slot: number) => void;
  readonly submit: () => void;
  readonly retry: () => void;
}

export type TermoChrome = Omit<ArchivePlayChrome, "note"> & {
  readonly note?: ArchivePlayChrome["note"];
  readonly topTag?: string;
  readonly picker?: ReactNode;
  readonly rules?: string;
  readonly pageClassName?: string;
};
