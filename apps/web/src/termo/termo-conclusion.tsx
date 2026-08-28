"use client";

import { MAX_GUESSES } from "@miolos/games/termo";

import { messages } from "../i18n";
import { ConclusionView, type ConclusionResult } from "../play/conclusion-view";
import type { ConclusionAnswer, ConclusionOutcome } from "../play/types";
import { useRecordSnapshot } from "../play/use-record-snapshot";

const copy = messages.games.termo;

export interface TermoOutcomeSource {
  readonly won: boolean;

  readonly used: number;

  readonly canonical: string;
}

export function TermoConclusion({
  date,
  result,
  live,
}: {
  readonly date: string;
  readonly result?: ConclusionResult;
  readonly live?: TermoOutcomeSource;
}) {
  const snapshot = useRecordSnapshot("termo", date);
  const stored = snapshot.hydrated ? snapshot.record : undefined;

  const fromRecord: TermoOutcomeSource | undefined =
    stored?.game === "termo" &&
    stored.concluded &&
    stored.outcome !== undefined &&
    stored.answer !== undefined
      ? {
          won: stored.outcome === "won",
          used: stored.guesses.length,
          canonical: stored.answer,
        }
      : undefined;

  const source = fromRecord ?? live;

  return (
    <ConclusionView
      game="termo"
      date={date}
      copy={copy.conclusion}
      result={result}
      outcome={outcomeFor(source)}
      answer={answerFor(source)}
    />
  );
}

function outcomeFor(
  source: TermoOutcomeSource | undefined,
): ConclusionOutcome | undefined {
  if (source === undefined) {
    return undefined;
  }
  return source.won
    ? {
        state: "result",
        label: copy.outcome.wonLabel,
        detail: copy.outcome.wonDetail(source.used, MAX_GUESSES),
        aria: copy.outcome.wonAria(source.used, MAX_GUESSES),
      }
    : {
        state: "lost",
        label: copy.outcome.lostLabel,
        detail: copy.outcome.lostDetail(MAX_GUESSES),
        aria: copy.outcome.lostAria(MAX_GUESSES),
      };
}

function answerFor(
  source: TermoOutcomeSource | undefined,
): ConclusionAnswer | undefined {
  if (source === undefined) {
    return undefined;
  }
  return {
    result: source.won
      ? copy.dayWord.won(source.used, MAX_GUESSES)
      : copy.dayWord.lost(MAX_GUESSES),
    lead: copy.dayWord.lead,
    canonical: source.canonical,
  };
}
