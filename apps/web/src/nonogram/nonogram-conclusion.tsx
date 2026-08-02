"use client";

import { messages } from "../i18n";
import { ConclusionView, type ConclusionResult } from "../play/conclusion-view";
import type { ConclusionPicture } from "../play/types";
import { useRecordSnapshot } from "../play/use-record-snapshot";

/**
 * The Nonogram's own conclusion mount (plan 020 §13.3, ADR-0034): the shared
 * `<ConclusionView/>` plus the one thing that is not game-blind — the picture.
 *
 * It exists rather than a `record.game === "nonogram"` branch inside
 * `conclusion-view.tsx` because ADR-0029 decision 2 puts JSX composition per
 * game and keeps the shared conclusion game-blind. Narrowing a record to one
 * game is per-game code and belongs here.
 *
 * Both mounts land on it. `/nonogram` swaps it in place with `result` and a
 * `picture` computed from the live play state; `/nonogram/concluido` renders
 * it with `date` alone, because a server segment must never compute the
 * bitmap — that route renders for players who have NOT solved, and a
 * server-computed picture would put a derived solution in its RSC payload
 * (ADR-0004, ADR-0033, ADR-0034 decision 3).
 *
 * The picture has no curated name (ADR-0033), so the accessible name
 * DESCRIBES the figure. It is composed here, from this app's own message
 * bundle, and handed down as a plain string: `ConclusionPicture` is plain data
 * across the RSC boundary and a function member would be an HTTP 500 nothing
 * but `route-ssr.test.tsx` can see.
 */
export function NonogramConclusion({
  date,
  result,
  picture,
}: {
  readonly date: string;
  readonly result?: ConclusionResult;
  readonly picture?: ConclusionPicture;
}) {
  // The SAME `(game, date)` key `<ConclusionView/>` subscribes with,
  // deliberately: `use-record-snapshot`'s cache is a single module slot keyed
  // `{game, date}` (:43-49), so two subscribers on one key share one cached
  // object and neither re-renders. Two subscribers on DIFFERENT keys would
  // thrash that slot and `useSyncExternalStore` would loop. Do not "optimise"
  // this into a different key.
  const snapshot = useRecordSnapshot("nonogram", date);
  const stored = snapshot.hydrated ? snapshot.record : undefined;
  const fromRecord: ConclusionPicture | undefined =
    stored?.game === "nonogram" && stored.concluded && stored.grid !== undefined
      ? {
          size: stored.size,
          cells: stored.grid,
          label: messages.games.nonogram.reveal.aria,
        }
      : undefined;

  return (
    <ConclusionView
      game="nonogram"
      date={date}
      copy={messages.games.nonogram.conclusion}
      result={result}
      // Precedence mirrors the stamp's own `stored ?? result`: on the in-place
      // first paint the stored record is still the last PLAYING one
      // (`concluded: false`, `grid: undefined`) so the prop wins; one commit
      // later the concluded record carries an identical bitmap, so there is no
      // flicker. Where `localStorage` throws there is never a record at all,
      // and the prop is the only source there is.
      picture={fromRecord ?? picture}
    />
  );
}
