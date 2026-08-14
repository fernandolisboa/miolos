"use client";

import type { DailyTermoResponse } from "@miolos/core";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import { elapsedMs } from "../play/timer";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "./play-view";
import { TermoConclusion } from "./termo-conclusion";
import { useTermoPlay } from "./use-termo-play";

/**
 * The play screen's client root. It swaps its body from `<PlayView/>` to the
 * conclusion once the board CLOSES — no navigation, no RSC fetch — and
 * `/termo/concluido` renders the same conclusion under its own server segment
 * for a bookmark, a reload and `impeccable detect`.
 *
 * "CLOSES", never "solves": Termo is the first game whose two terminal states
 * are not the same event (ADR-0044). A loss is a conclusion, and it is the
 * conclusion's `lost` branch rather than a play view that never leaves.
 *
 * The page shell passes the wall's projection and nothing else — `{game,
 * date}` — so the RSC payload physically cannot carry the answer this
 * component never received. That is SHARPER for Termo than for the three
 * shipped games: the word is derivable from nothing on the client, so a
 * server-computed reveal would be the only channel and the leak would be
 * total (ADR-0004, ADR-0040).
 *
 * The prop is `DailyTermoResponse`, never the union: a per-game component
 * that took `DailyPuzzleResponse` and narrowed internally would carry a
 * branch that cannot happen, which is the branch the narrowing exists to
 * delete.
 */
export function TermoScreen({ daily }: { readonly daily: DailyTermoResponse }) {
  const play = useTermoPlay(daily);

  // The server told us this day is gone (a 404 from the guess route), so the
  // board the player is looking at can never be judged again. The same screen
  // the route renders when the wall returns nothing (ADR-0028 decision 4).
  //
  // It sits BELOW the hook by the rules of hooks, which is also what keeps
  // the record restore, the prune and the queue flush running on this route.
  if (play.unavailable) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }

  // The record has not been read yet, so NOTHING derived from it may paint.
  // Without this gate, reloading /termo on a day the player already finished
  // renders the full play screen — their guesses wiped back to an empty
  // board, six turns apparently unspent — until hydration swaps in the
  // conclusion.
  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} />;
  }

  // Closed AND frozen, through the shared predicate (#31 step-6 F15): the
  // clock is frozen one commit after the board closes, and swapping early
  // would record a time the pause is about to correct. A restored concluded
  // record is already frozen, so it lands here on its first paint. Termo is
  // the game whose loss makes "closed" wider than "solved", which is exactly
  // why the predicate is `status !== "playing"` and lives in one place.
  if (isClosedAndFrozen(play.state)) {
    return (
      <TermoConclusion
        date={daily.date}
        // Still passed, and neither field is rendered for this game: the
        // conclusion's `result` branch GATES on it (ADR-0043 decision 5), and
        // the recorded elapsed time is the real one the completion carries.
        result={{
          elapsedMs: elapsedMs(play.state.timer, play.state.now),
          hintsUsed: 0,
        }}
        // `answer` is in state before `status` leaves "playing" — that is the
        // reducer's ordering contract, and it is what makes this read total
        // rather than optimistic. The `undefined` arm is unreachable; it
        // exists because TypeScript cannot see the contract, and omitting the
        // prop is strictly better than fabricating a word.
        live={
          play.state.answer === undefined
            ? undefined
            : {
                won: play.state.status === "solved",
                used: play.state.guesses.length,
                canonical: play.state.answer,
              }
        }
      />
    );
  }

  return <PlayView play={play} />;
}
