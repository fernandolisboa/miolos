"use client";

import { messages } from "../i18n";
import { ConclusionView, type ConclusionResult } from "../play/conclusion-view";
import { useServerDayClaim } from "../play/day-state";
import type { ConclusionPicture } from "../play/types";
import { useRecordSnapshot } from "../play/use-record-snapshot";

/**
 * The Nonogram's own conclusion mount (ADR-0034): the shared
 * `<ConclusionView/>` plus the one thing that is not game-blind — the picture.
 *
 * Both mounts land on it. `/nonogram` swaps it in place with `result` and a
 * `picture` computed from the live play state; `/nonogram/concluido` renders
 * it with `date` alone, because a server segment must never compute the
 * bitmap — that route renders for players who have NOT solved, and a
 * server-computed picture would put a derived solution in its RSC payload
 * (ADR-0004, ADR-0033, ADR-0034 decision 3).
 *
 * ALL THE NONOGRAM COPY IS COMPOSED HERE and handed down as plain strings —
 * the lead, the name and the named accessible label alike. `ConclusionPicture`
 * is plain data across the RSC boundary and a function member would be an HTTP
 * 500 nothing but `route-ssr.test.tsx` can see.
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
  // deliberately. `use-record-snapshot`'s cache is a `(game, date)`-keyed
  // `Map` (#96, ADR-0056 decision 1), so two different keys no longer thrash
  // each other — that defect is gone. Sharing this one still buys what
  // matters: ONE entry and ONE live consumer of it, so both subscribers get
  // the same cached object back and neither re-renders. Do not "optimise"
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

  // The server's claim about today's Nonogram (#64). `undefined` until the
  // day-truth payload lands and says `completed` — which is every paint
  // before the completion syncs, and every paint at all for an offline
  // player.
  const claim = useServerDayClaim(date, "nonogram");

  // Precedence mirrors the stamp's own `stored ?? result`: on the in-place
  // first paint the stored record is still the last PLAYING one
  // (`concluded: false`, `grid: undefined`) so the prop wins; one commit
  // later the concluded record carries an identical bitmap, so there is no
  // flicker. Where `localStorage` throws there is never a record at all, and
  // the prop is the only source there is.
  const resolved = fromRecord ?? picture;
  // Composed ONCE, and AFTER that precedence — never on each arm. `fromRecord`
  // wins on every path but the in-place first paint and the throwing-storage
  // case, so naming inside the ternary above would leave a live arm unnamed
  // and produce a caption that appears and disappears across one commit.
  const named =
    resolved && claim?.motifName
      ? {
          ...resolved,
          name: claim.motifName,
          lead: messages.games.nonogram.reveal.lead,
          label: messages.games.nonogram.reveal.namedAria(claim.motifName),
        }
      : resolved;

  return (
    <ConclusionView
      game="nonogram"
      date={date}
      copy={messages.games.nonogram.conclusion}
      result={result}
      picture={named}
    />
  );
}
