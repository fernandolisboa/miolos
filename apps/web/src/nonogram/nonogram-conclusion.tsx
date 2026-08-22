"use client";

import { messages } from "../i18n";
import { ConclusionView, type ConclusionResult } from "../play/conclusion-view";
import { useServerDayClaim } from "../play/day-state";
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
 * THE PICTURE IS NAMED SINCE #64 (ADR-0070, superseding ADR-0033 decision
 * 1's name clause), and the name arrives over the WIRE, never from the
 * bundle: `useServerDayClaim` reads the motif name off this user's own
 * completed day claim. The motif tables stay server-side, which is why the
 * bundle grep in `scripts/route-client-js.mjs` is still armed.
 *
 * Its absence is the ordinary degraded case, not a failure — an offline
 * finish, any pre-sync paint, a deploy-skewed old payload, a killed daily
 * row. In every one of those the card renders exactly what shipped before
 * #64: the composed DESCRIPTION, and no caption. Nothing is ever fabricated.
 *
 * ALL THE NONOGRAM COPY IS COMPOSED HERE and handed down as plain strings —
 * the lead, the name and the named accessible label alike. `ConclusionView`
 * is game-blind and imports no `messages.games.nonogram.*`; Termo's `answer`
 * prop is the shipped precedent for the shape. `ConclusionPicture` is plain
 * data across the RSC boundary and a function member would be an HTTP 500
 * nothing but `route-ssr.test.tsx` can see.
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
