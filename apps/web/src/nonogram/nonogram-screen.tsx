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
 * `conclusion-lazy.tsx` (#145 step 7, ADR-0054 decision 15): this
 * screen root is `/nonogram`'s first-load set, and the wrapper statically
 * imports the whole conclusion tree. `/nonogram/concluido` keeps its own
 * STATIC import of the wrapper — that segment's server render is the
 * bookmark/detect surface and must keep carrying real markup.
 * `resilientConclusion` attaches the pending skeleton and the
 * retry-then-fallback failure story (#145 step-7b, blocker 2); the
 * fallback carries the stamp word and the frozen time from the caller's
 * own `result`, and deliberately no picture — the reveal is a rich payoff
 * the degraded frame does not promise.
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
 * The play screen's client root (plan 020 §10.6). It swaps its body from
 * `<PlayView/>` to `<ConclusionView/>` once the picture closes — no
 * navigation, no RSC fetch, so finishing offline works with no service worker.
 * `/nonogram/concluido` renders the same `<ConclusionView/>` under its own
 * server segment for a bookmark, a reload and `impeccable detect`.
 *
 * The page shell passes the wall's reveal-free projection and nothing else:
 * the RSC payload physically cannot carry what this component never received
 * (ADR-0033).
 *
 * The prop is `DailyNonogramResponse`, never the union (plan 018 S11): a
 * per-game component that took `DailyPuzzleResponse` and narrowed internally
 * would carry a branch that cannot happen, which is the branch the narrowing
 * exists to delete.
 */
export function NonogramScreen({
  daily,
}: {
  readonly daily: DailyNonogramResponse;
}) {
  const play = useNonogramPlay(daily);
  // The server's claim about this game (#142, ADR-0065), hoisted here — the
  // top of the root, beside the play hook — by the rules of hooks: every
  // early return below would make a later call conditional. Only the BRANCH
  // on its answer sits after `isClosedAndFrozen`, so this device's own
  // closed record always outranks the claim (ADR-0060 decision 7's mirror).
  const claim = useServerDayClaim(daily.date, "nonogram");

  // The claim's swap below is render-time only, so the play hook keeps
  // running behind the remote view (#142 step 7, step-6 correctness F3):
  // left alone, its 1 Hz tick re-renders a static conclusion once a second
  // and the next hide-persist rewrites the preserved in-progress record
  // with an inflated `elapsedMs`. Freeze the clock instead. The timer term
  // re-arms the effect when a visibility resume restarts the clock behind
  // the view; `pause` is idempotent, and a locally-closed board is
  // unaffected (its clock is already frozen when its conclusion swaps in).
  const claimOwnsScreen =
    claim !== undefined && play.state.timer.runningSince !== null;
  const pause = play.pause;
  useEffect(() => {
    if (claimOwnsScreen) {
      pause();
    }
  }, [claimOwnsScreen, pause]);

  // Warm the conclusion chunk while the player is still solving (#145
  // step 7, ADR-0054 decision 15's relief): the conclusion tree left this
  // route's first-load set, and this background import is what makes the
  // win-moment swap resolve from the module cache instead of flashing a
  // blank where the celebration goes. A code chunk, never puzzle content —
  // ADR-0004 untouched. The named preload warms the per-game wrapper AND,
  // through its static import, the shared conclusion tree — and being a
  // named export of `conclusion-lazy` is what makes the warm testable
  // (T-WEB-S289).
  useEffect(() => {
    preloadNonogramConclusion();
  }, []);

  // The clues did not solve to an exact bitmap, so there is no picture to
  // compare against and the board could never close (§10.4). ADR-0021
  // decision 3 makes line-solvability a binary mechanical gate over all 265
  // motif variants, so this is unreachable for a published daily — but an
  // unreachable branch still has to be defined, and this one reuses the
  // shipped screen rather than crashing. It is a pure function of `daily`, so
  // server and client agree and there is no hydration mismatch; and
  // `DailyUnavailable` emits neither marker attribute, so the impeccable
  // preflight would fail loudly rather than scan a board that never rendered.
  //
  // It sits BELOW the hook by the rules of hooks, which is also what keeps the
  // record restore, the prune and the queue flush running on this route: the
  // lifecycle's mount effect is ungated, so a player with a stranded
  // `pendingSync` record still drains it from here. Only the board is skipped.
  if (play.state.solution === null) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }

  // The record has not been read yet, so NOTHING derived from it may paint.
  // Without this gate, reloading /nonogram on a day the player already
  // finished renders the full play screen — their picture wiped back to an
  // empty board, 00:00 on the clock, the hint button live — until hydration
  // swaps in the conclusion (finding
  // `binairo-reload-flashes-a-blank-board-over-a-finished-day`).
  if (!play.state.hydrated) {
    return (
      <PlaySkeleton date={daily.date} size={daily.size} clues={daily.clues} />
    );
  }

  // Closed AND frozen, through the shared predicate (#31 step-6 F15): the
  // clock is frozen one commit after the picture closes, and swapping early would
  // stamp a time the pause is about to correct. A restored `concluded` record
  // is already frozen, so it lands here on its first paint. The `solved` term
  // stays VISIBLE beside it rather than folded into a re-typed conjunct —
  // this game has no losing state and the conclusion it renders is a win.
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
        // The `null` branch is DEFINED-UNREACHABLE, not assumed away (landmine
        // 8), and the argument is written here so nobody adds a test for a
        // state the invariants forbid: `submittedCells` returns null only on
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

  // The day was decided on ANOTHER device (#142, ADR-0065, amending
  // ADR-0060 decision 8): the server claims this game and this device holds
  // no closed record, so the completed view renders instead of a fresh
  // playable board — over an in-progress board too, by the same render-time
  // swap the local closure uses; the in-progress record is neither written
  // nor deleted (ADR-0060 decision 4 untouched). The view renders NO
  // picture: the solved bitmap is the solution, which is puzzle content and
  // never on this wire (ADR-0004).
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
