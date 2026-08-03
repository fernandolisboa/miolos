"use client";

import { MAX_GUESSES } from "@miolos/games/termo";

import { messages } from "../i18n";
import { ConclusionView, type ConclusionResult } from "../play/conclusion-view";
import type { ConclusionAnswer, ConclusionOutcome } from "../play/types";
import { useRecordSnapshot } from "../play/use-record-snapshot";

const copy = messages.games.termo;

/**
 * The one bit the whole conclusion turns on, plus the two numbers its strings
 * need. TWO SOURCES, ONE MAPPING: in place on `/termo` the screen reads
 * `state.status` (`solved → won`), and on `/termo/concluido` there is no live
 * state, so this component reads the RECORD's `outcome` field — whose value
 * `buildRecord` wrote from that same `state.status`. One mapping, two
 * readings of it, no third definition.
 */
export interface TermoOutcomeSource {
  readonly won: boolean;
  /** Guesses spent — the win stamp's `4/6`. */
  readonly used: number;
  /** The day's word in its accented spelling. */
  readonly canonical: string;
}

/**
 * The Termo conclusion mount (#27, ADR-0043): the shared `<ConclusionView/>`
 * plus the two things that are not game-blind — the stamp's own slots, and
 * the day's word.
 *
 * It exists rather than a `record.game === "termo"` branch inside
 * `conclusion-view.tsx` because ADR-0029 decision 2 puts JSX composition per
 * game and keeps the shared conclusion game-blind. Narrowing a record to one
 * game is per-game code and belongs here. `NonogramConclusion` is the shipped
 * precedent, and this follows it hop for hop.
 *
 * EVERY STRING IS COMPOSED HERE AND HANDED DOWN FINISHED. `ConclusionOutcome`
 * and `ConclusionAnswer` are plain data across the RSC boundary (ADR-0043
 * decision 8): a function member there does not fail typecheck, does not fail
 * a component test, and throws "Functions cannot be passed directly to Client
 * Components" the first time the route is server-rendered — an HTTP 500 only
 * `test/route-ssr.test.tsx` can see, and #23 shipped exactly that bug in
 * exactly this file.
 */
export function TermoConclusion({
  date,
  result,
  live,
}: {
  readonly date: string;
  readonly result?: ConclusionResult;
  readonly live?: TermoOutcomeSource;
}) {
  // The SAME `(game, date)` key `<ConclusionView/>` subscribes with,
  // deliberately: `use-record-snapshot`'s cache is a single module slot keyed
  // `{game, date}`, so two subscribers on one key share one cached object and
  // neither re-renders. Two subscribers on DIFFERENT keys would thrash that
  // slot and `useSyncExternalStore` would loop.
  const snapshot = useRecordSnapshot("termo", date);
  const stored = snapshot.hydrated ? snapshot.record : undefined;
  // The record's `superRefine` ties `answer` and `outcome` to `concluded`, so
  // a concluded record ALWAYS carries both and a record that lost one is
  // unparseable — which is what makes an empty word structurally unrenderable
  // rather than merely unlikely. The three checks are what narrows the union.
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
  // Precedence mirrors the stamp's own `stored ?? result`: on the in-place
  // first paint the stored record is still the last PLAYING one, so the prop
  // wins; one commit later the concluded record says the same thing, so there
  // is no flicker. Where `localStorage` throws there is never a record at
  // all, and the prop is the only source there is.
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

/**
 * ONE prop for BOTH outcomes, and the win is a `"result"` state rather than a
 * fourth value: gating the loss branch on the prop's PRESENCE would render
 * every Termo win as a loss (ADR-0043 decision 1). Termo passes it on both,
 * because none of the shipped stamp's three slots is honest here — there is
 * no hint to have gone without (ADR-0045 decision 1) and the elapsed time is
 * dominated by the per-guess round trip (decision 4).
 *
 * NO SETTLE ANIMATION ON A LOSS, and nothing here says so: `state: "lost"` is
 * the whole of it, and `OutcomeStamp` derives `.stampStill` from it. There is
 * no consolation flourish, no second stamp design, no mascot and no emoji —
 * THE LOSS EQUIVALENT OF THE CELEBRATION IS THE CELEBRATION'S ABSENCE.
 */
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

/**
 * The day's word (AC 2), on BOTH outcomes. On a win it is not redundant: the
 * player typed the word accent-free, so the accents are the one thing they
 * have not seen.
 */
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
