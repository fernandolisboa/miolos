"use client";

import { messages } from "../i18n";
import { ConclusionView, type ConclusionResult } from "../play/conclusion-view";
import { useServerDayClaim } from "../play/day-state";
import type { ConclusionPicture } from "../play/types";
import { useRecordSnapshot } from "../play/use-record-snapshot";

export function NonogramConclusion({
  date,
  result,
  picture,
}: {
  readonly date: string;
  readonly result?: ConclusionResult;
  readonly picture?: ConclusionPicture;
}) {
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

  const claim = useServerDayClaim(date, "nonogram");

  const resolved = fromRecord ?? picture;

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
