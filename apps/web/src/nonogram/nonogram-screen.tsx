"use client";

import type { DailyNonogramResponse } from "@miolos/core";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import { submittedCells } from "./engine";
import { NonogramConclusion } from "./nonogram-conclusion";
import { PlaySkeleton, PlayView } from "./play-view";
import { useNonogramPlay } from "./use-nonogram-play";

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

  // Both conditions, not just `solved`: the clock is frozen one commit after
  // the picture closes, and swapping early would stamp a time the pause is
  // about to correct. A restored `concluded` record is already frozen, so it
  // lands here on its first paint.
  if (
    play.state.status === "solved" &&
    play.state.timer.runningSince === null
  ) {
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
        // `stored?.syncOutcome === undefined` precedent at
        // conclusion-view.tsx:98-108).
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

  return <PlayView play={play} />;
}
