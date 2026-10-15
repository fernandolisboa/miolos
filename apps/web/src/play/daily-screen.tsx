"use client";

import type { DayGameState, Game } from "@miolos/core";
import { useEffect, useRef, type ReactNode } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import {
  ConclusionView,
  preloadConclusionView,
  RemoteConclusionView,
} from "./conclusion-lazy";
import type { ConclusionResult } from "./conclusion-view";
import { JustEnded, useSawPlay } from "./just-ended";
import type { PlayCore } from "./types";
import { isClosedAndFrozen } from "./use-play-lifecycle";

type DailyScreenProps = {
  readonly game: Game;
  readonly claim: DayGameState | undefined;
  readonly state: PlayCore;
  readonly unavailable?: boolean;
  readonly skeleton: ReactNode;
  readonly view: ReactNode;
} & (
  | { readonly result: ConclusionResult; readonly conclusion?: never }
  | {
      readonly conclusion: {
        readonly render: () => ReactNode;
        readonly preload: () => void;
      };
      readonly result?: never;
    }
);

export function DailyScreen(props: DailyScreenProps) {
  const { game, claim, state, unavailable = false, skeleton, view } = props;
  const preload = props.conclusion?.preload ?? preloadConclusionView;

  const preloadOnMount = useRef(preload);
  useEffect(() => {
    preloadOnMount.current();
  }, []);

  const copy = messages.games[game];
  const closed = isClosedAndFrozen(state);
  const ended = useSawPlay(
    !unavailable && state.hydrated && !closed && claim === undefined,
  );

  if (unavailable) {
    return <DailyUnavailable copy={copy.play.unavailable} />;
  }

  if (!state.hydrated) {
    return skeleton;
  }

  if (closed) {
    return (
      <JustEnded value={ended}>
        {props.conclusion === undefined ? (
          <ConclusionView
            game={game}
            date={state.date}
            copy={copy.conclusion}
            result={props.result}
          />
        ) : (
          props.conclusion.render()
        )}
      </JustEnded>
    );
  }

  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game={game}
        date={state.date}
        copy={copy.conclusion}
        claim={claim}
      />
    );
  }

  return view;
}
