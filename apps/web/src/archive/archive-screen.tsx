"use client";

import type { Game } from "@miolos/core";
import type { ReactNode } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import { EndingStage } from "../play/ending-stage";
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

  return (
    <EndingStage
      over={closed}
      won={ended && state.status === "solved"}
      ending={() => (
        <JustEnded value={ended}>
          <LateResult
            game={game}
            date={state.date}
            outcome={state.status === "solved" ? "won" : "lost"}
            alreadyConcluded={alreadyConcluded}
          />
        </JustEnded>
      )}
    >
      {view}
    </EndingStage>
  );
}
