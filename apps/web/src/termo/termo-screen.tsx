"use client";

import type { DailyTermoResponse } from "@miolos/core";
import { useEffect } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import {
  ConclusionChunkFallback,
  preloadTermoConclusion,
  RemoteConclusionView,
  resilientConclusion,
} from "../play/conclusion-lazy";
import { useServerDayClaim } from "../play/day-state";
import { elapsedMs } from "../play/timer";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "./play-view";
import { useTermoPlay } from "./use-termo-play";

/**
 * The per-game conclusion wrapper rides the same lazy boundary as
 * `conclusion-lazy.tsx` (#145, ADR-0054 decision 15): this screen root is
 * `/termo`'s first-load set, and the wrapper statically imports the whole
 * conclusion tree. `/termo/concluido` keeps its own STATIC import of the
 * wrapper — that segment's server render is the bookmark/detect surface and
 * must keep carrying real markup. `resilientConclusion` attaches the pending
 * skeleton and the retry-then-fallback failure story (#145); the fallback
 * carries NO stamp, because a Termo conclusion never shows a time (ADR-0045
 * decision 4) and a lost board must not wear the stamp word — the titled card
 * understates and never lies.
 */
const TermoConclusion = resilientConclusion<
  Parameters<typeof import("./termo-conclusion").TermoConclusion>[0]
>(
  async () => (await import("./termo-conclusion")).TermoConclusion,
  () => <ConclusionChunkFallback copy={messages.games.termo.conclusion} />,
);

/**
 * The play screen's client root.
 *
 * The page shell passes the wall's projection and nothing else — `{game,
 * date}` — so the RSC payload physically cannot carry the answer this
 * component never received. That is SHARPER for Termo than for the three
 * shipped games: the word is derivable from nothing on the client, so a
 * server-computed reveal would be the only channel and the leak would be
 * total (ADR-0004, ADR-0040).
 */
export function TermoScreen({ daily }: { readonly daily: DailyTermoResponse }) {
  // The server's claim about this game (#142, ADR-0065), hoisted here — the
  // top of the root, beside the play hook — by the rules of hooks: every
  // early return below would make a later call conditional.
  const claim = useServerDayClaim(daily.date, "termo");
  const play = useTermoPlay(daily, claim !== undefined);

  // The claim's swap below is render-time only, so the play hook keeps running
  // behind the remote view (#142): left alone, its 1 Hz tick re-renders a
  // static conclusion once a second and the next hide-persist rewrites the
  // preserved in-progress record with an inflated `elapsedMs`. Freeze the
  // clock instead. The timer term re-arms the effect when a visibility resume
  // restarts the clock behind the view; `pause` is idempotent, and a
  // locally-closed board is unaffected (its clock is already frozen when its
  // conclusion swaps in).
  const claimOwnsScreen =
    claim !== undefined && play.state.timer.runningSince !== null;
  const pause = play.pause;
  useEffect(() => {
    if (claimOwnsScreen) {
      pause();
    }
  }, [claimOwnsScreen, pause]);

  useEffect(() => {
    preloadTermoConclusion();
  }, []);

  // The server told us this day is gone (a 404 from the guess route), so the
  // board the player is looking at can never be judged again. The same screen
  // the route renders when the wall returns nothing (ADR-0028 decision 4).
  //
  // It sits BELOW the hook by the rules of hooks, which is also what keeps
  // the record restore, the prune and the queue flush running on this route.
  if (play.unavailable) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} />;
  }

  // Closed AND frozen, through the shared predicate (#31): the clock is frozen
  // one commit after the board closes, and swapping early would record a time
  // the pause is about to correct. Termo is the game whose loss makes "closed"
  // wider than "solved", which is exactly why the predicate is `status !==
  // "playing"` and lives in one place.
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

  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game="termo"
        date={daily.date}
        copy={messages.games.termo.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
