"use client";

import type { Game } from "@miolos/core";
import type { ReactNode } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import { JustEnded, useSawPlay } from "../play/just-ended";
import type { PlayCore } from "../play/types";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

export function ArchiveScreen({
  game,
  state,
  unavailable = false,
  skeleton,
  view,
}: {
  readonly game: Game;
  readonly state: PlayCore;
  readonly unavailable?: boolean;
  readonly skeleton: ReactNode;
  readonly view: ReactNode;
}) {
  const alreadyConcluded = usePriorConclusion(game, state.date);
  const closed = isClosedAndFrozen(state);
  const ended = useSawPlay(!unavailable && state.hydrated && !closed);

  if (unavailable) {
    return <DailyUnavailable copy={messages.games[game].play.unavailable} />;
  }

  if (!state.hydrated) {
    return skeleton;
  }

  if (closed) {
    return (
      <JustEnded value={ended}>
        <LateResult
          game={game}
          date={state.date}
          outcome={state.status === "solved" ? "won" : "lost"}
          alreadyConcluded={alreadyConcluded}
        />
      </JustEnded>
    );
  }

  return view;
}
