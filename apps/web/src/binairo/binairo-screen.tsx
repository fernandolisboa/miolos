"use client";

import type { DailyBinairoResponse } from "@miolos/core";
import { useEffect } from "react";

import { messages } from "../i18n";
import { ConclusionView, RemoteConclusionView } from "../play/conclusion-view";
import { useServerDayClaim } from "../play/day-state";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "./play-view";
import { useBinairoPlay } from "./use-binairo-play";

/**
 * The play screen's client root (plan 017 §12.2). It swaps its body from
 * `<PlayView/>` to `<ConclusionView/>` once the grid closes — no
 * navigation, no RSC fetch, so finishing offline works with no service
 * worker (D26). `/binairo/concluido` renders the same `<ConclusionView/>`
 * under its own server segment for a bookmark, a reload and
 * `impeccable detect`.
 *
 * The page shell passes the wall's solution-free projection and nothing
 * else (D4): the RSC payload physically cannot carry what this component
 * never received.
 *
 * The prop is `DailyBinairoResponse`, never the union (plan 018 S11): a
 * per-game component that took `DailyPuzzleResponse` and narrowed
 * internally would carry a branch that cannot happen, which is the branch
 * the narrowing exists to delete.
 */
export function BinairoScreen({
  daily,
}: {
  readonly daily: DailyBinairoResponse;
}) {
  const play = useBinairoPlay(daily);
  // The server's claim about this game (#142, ADR-0065), hoisted here — the
  // top of the root, beside the play hook — by the rules of hooks: every
  // early return below would make a later call conditional. Only the BRANCH
  // on its answer sits after `isClosedAndFrozen`, so this device's own
  // closed record always outranks the claim (ADR-0060 decision 7's mirror).
  const claim = useServerDayClaim(daily.date, "binairo");

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

  // The record has not been read yet, so NOTHING derived from it may paint
  // (D28). Without this gate, reloading /binairo on a day the player already
  // finished renders the full play screen — their solved board wiped back to
  // its givens, 00:00 on the clock, the hint button live — until hydration
  // swaps in the conclusion (finding
  // `binairo-reload-flashes-a-blank-board-over-a-finished-day`).
  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} />;
  }

  // Closed AND frozen, through the shared predicate (#31 step-6 F15): the
  // clock is frozen one commit after the grid closes, and swapping early would
  // stamp a time the pause is about to correct. A restored `concluded` record
  // is already frozen, so it lands here on its first paint. The `solved` term
  // stays VISIBLE beside it rather than folded into a re-typed conjunct —
  // this game has no losing state and the conclusion it renders is a win.
  if (isClosedAndFrozen(play.state) && play.state.status === "solved") {
    return (
      <ConclusionView
        game="binairo"
        date={daily.date}
        copy={messages.games.binairo.conclusion}
        result={{
          elapsedMs: play.elapsed,
          hintsUsed: play.state.hint.used,
        }}
      />
    );
  }

  // The day was decided on ANOTHER device (#142, ADR-0065, amending
  // ADR-0060 decision 8): the server claims this game and this device holds
  // no closed record, so the completed view renders instead of a fresh
  // playable board — over an in-progress board too, by the same render-time
  // swap the local closure uses; the in-progress record is neither written
  // nor deleted (ADR-0060 decision 4 untouched).
  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game="binairo"
        date={daily.date}
        copy={messages.games.binairo.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
