import { TERMO_MAX_GUESSES, type Game } from "@miolos/core";

import { formatElapsed, formatShortDate, messages } from "../i18n";
import type { TermoPlayRecord } from "./play-record";

export type ShareSubject =
  | TermoPlayRecord
  | {
      readonly game: Exclude<Game, "termo">;
      readonly date: string;
      readonly elapsedMs: number;
    };

export function buildShareText(
  subject: ShareSubject,
  options: { readonly url: string },
): string {
  const header = messages.share.header(
    messages.games[subject.game].name,
    formatShortDate(subject.date),
  );

  const lines =
    subject.game === "termo"
      ? [
          header,
          subject.outcome === "won"
            ? messages.share.termoWon(subject.guesses.length, TERMO_MAX_GUESSES)
            : messages.share.termoLost(TERMO_MAX_GUESSES),
          "",

          ...subject.guesses.map((row) =>
            row.tiles.map((tile) => messages.share.tiles[tile]).join(""),
          ),
          "",
          options.url,
        ]
      : [header, formatElapsed(subject.elapsedMs), "", options.url];

  return lines.join("\n");
}
