import type { DailyTermoResponse } from "@miolos/core";
import { useEffect } from "react";

import { recordHeader, type TermoPlayRecord } from "../play/play-record";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { postGuesses } from "./guess-client";
import { termoPlayReducer } from "./state";
import type { TermoPlay, TermoPlayState, TermoVerdict } from "./types";
import { useTermoBoard } from "./use-termo-board";

export function useTermoPlay(
  daily: DailyTermoResponse,
  remotelyClaimed = false,
): TermoPlay {
  const { play, dispatch } = useTermoBoard(daily.date, judgeOnServer);
  const { state, retry } = play;

  usePlayLifecycle({
    game: "termo",
    state,
    reduce: termoPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,

    persistDeps: [state.guesses],
  });

  useEffect(() => {
    const onOnline = () => {
      retry();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [retry]);

  return play;
}

async function judgeOnServer(
  armed: TermoPlayState,
  pending: string,
): Promise<TermoVerdict> {
  const words = [...armed.guesses.map((row) => row.guess), pending];
  const outcome = await postGuesses(armed.date, words);

  switch (outcome.kind) {
    case "judged": {
      const tiles = outcome.tiles.at(-1);
      if (tiles === undefined || outcome.tiles.length !== words.length) {
        console.error(
          `a termo verdict carried ${String(outcome.tiles.length)} rows for ${String(words.length)} guesses; the turn is held`,
        );
        return { type: "held", reason: "server" };
      }
      return {
        type: "judged",
        guess: pending,
        tiles,
        status: outcome.status,
        answer: outcome.answer,
      };
    }
    case "held":
      return { type: "held", reason: outcome.reason };
    case "rejected":
      return { type: "rejected", reason: outcome.reason };
    case "gone":
      return { type: "gone" };
  }
}

function buildRecord(
  state: TermoPlayState,
  now: number,
  closed: boolean,
): TermoPlayRecord {
  return {
    ...recordHeader(state, now, closed, 0),
    game: "termo",
    guesses: state.guesses.map((row) => ({
      guess: row.guess,
      tiles: [...row.tiles],
    })),
    answer: closed ? state.answer : undefined,
    outcome: closed ? (state.status === "solved" ? "won" : "lost") : undefined,
  };
}
