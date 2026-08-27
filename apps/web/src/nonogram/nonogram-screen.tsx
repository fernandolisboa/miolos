"use client";

import type { DailyNonogramResponse } from "@miolos/core";
import { useEffect } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import {
  ConclusionChunkFallback,
  preloadNonogramConclusion,
  RemoteConclusionView,
  resilientConclusion,
} from "../play/conclusion-lazy";
import { useServerDayClaim } from "../play/day-state";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { submittedCells } from "./engine";
import { PlaySkeleton, PlayView } from "./play-view";
import { useNonogramPlay } from "./use-nonogram-play";

/**
 * The per-game conclusion wrapper rides the same lazy boundary as
 * `conclusion-lazy.tsx` (#145, ADR-0054 decision 15): this screen root is
 * `/nonogram`'s first-load set, and the wrapper statically imports the whole
 * conclusion tree. `/nonogram/concluido` keeps its own STATIC import of the
 * wrapper — that segment's server render is the bookmark/detect surface and
 * must keep carrying real markup. `resilientConclusion` attaches the pending
 * skeleton and the retry-then-fallback failure story (#145); the fallback
 * carries the stamp word and the frozen time from the caller's own `result`,
 * and deliberately no picture — the reveal is a rich payoff the degraded frame
 * does not promise.
 */
const NonogramConclusion = resilientConclusion<
  Parameters<typeof import("./nonogram-conclusion").NonogramConclusion>[0]
>(
  async () => (await import("./nonogram-conclusion")).NonogramConclusion,
  (props) => (
    <ConclusionChunkFallback
      copy={messages.games.nonogram.conclusion}
      stamp={props.result}
    />
  ),
);

/**
 * The play screen's client root.
 *
 * The page shell passes the wall's reveal-free projection and nothing else:
 * the RSC payload physically cannot carry what this component never received
 * (ADR-0033).
 */
export function NonogramScreen({
  daily,
}: {
  readonly daily: DailyNonogramResponse;
}) {
  // The server's claim about this game (#142, ADR-0065), hoisted here — the
  // top of the root, beside the play hook — by the rules of hooks: every
  // early return below would make a later call conditional.
  const claim = useServerDayClaim(daily.date, "nonogram");
  const play = useNonogramPlay(daily, claim !== undefined);

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
    preloadNonogramConclusion();
  }, []);

  // The clues did not solve to an exact bitmap, so there is no picture to
  // compare against and the board could never close. ADR-0021 decision 3 makes
  // line-solvability a binary mechanical gate over all 265 motif variants, so
  // this is unreachable for a published daily — but an unreachable branch still
  // has to be defined, and this one reuses the shipped screen rather than
  // crashing. It is a pure function of `daily`, so server and client agree and
  // there is no hydration mismatch; and `DailyUnavailable` emits neither marker
  // attribute, so the impeccable preflight would fail loudly rather than scan a
  // board that never rendered.
  //
  // It sits BELOW the hook by the rules of hooks, which is also what keeps the
  // record restore, the prune and the queue flush running on this route: the
  // lifecycle's mount effect is ungated, so a player with a stranded
  // `pendingSync` record still drains it from here. Only the board is skipped.
  if (play.state.solution === null) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }

  if (!play.state.hydrated) {
    return (
      <PlaySkeleton date={daily.date} size={daily.size} clues={daily.clues} />
    );
  }

  // Closed AND frozen, through the shared predicate (#31): the clock is frozen
  // one commit after the picture closes, and swapping early would stamp a time
  // the pause is about to correct.
  if (isClosedAndFrozen(play.state) && play.state.status === "solved") {
    const cells = submittedCells(play.state.entries, play.state.size ** 2);
    return (
      <NonogramConclusion
        date={daily.date}
        result={{
          elapsedMs: play.elapsed,
          hintsUsed: play.state.hint.used,
        }}
        // Omission, never an empty bitmap: `?? []` would supply a labelled
        // `<svg role="img">` with an empty `d` — a named graphic with no
        // graphic in it, and worse than saying nothing (the
        // `stored?.syncOutcome === undefined` precedent in
        // `play/conclusion-view.tsx`, where `undefined` "says nothing at
        // all").
        //
        // The `null` branch is DEFINED-UNREACHABLE, not assumed away, and the
        // argument is written here so nobody adds a test for a state the
        // invariants forbid: `submittedCells` returns null only on
        // `entries.length !== cells`; `initNonogramPlayState` allocates exactly
        // size² entries and no reducer case resizes the array; `restore`
        // rejects any record whose `size` or `entries.length` disagrees with
        // today's board; and this branch is only reached after
        // `isPictureComplete` iterated the full size² solution.
        picture={
          cells === null
            ? undefined
            : {
                size: play.state.size,
                cells: [...cells],
                label: messages.games.nonogram.reveal.aria,
              }
        }
      />
    );
  }

  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game="nonogram"
        date={daily.date}
        copy={messages.games.nonogram.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
