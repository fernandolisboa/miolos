/**
 * The medal derivation (#30, ADR-0052) — the `stats.ts`/`streak.ts`
 * register: no clock, no timezone, no I/O. Rule-derived medals recompute
 * from completion rows on every read (ADR-0009/ADR-0049 decision 6: a
 * merge needs ZERO medal-specific code beyond the curated-grants union,
 * and this module is why); nothing is ever stored for them.
 *
 * Every exclusion keeps its single spelling: the shared predicates are
 * imported from `../stats` (module-level exports added by #30 — never the
 * barrel), `computeStreak` and `perfectDays` are reused verbatim, and no
 * second spelling of any counting rule exists here.
 */
import { computeStreak } from "../streak";
import { epochDay } from "../date";
import { GAMES } from "../game";
import {
  countsLateWon,
  countsOnTimeWon,
  perfectDays,
  termoGuessOf,
  type StatsRow,
} from "../stats";
import { MEDAL_DEFINITIONS, type MedalId, type MedalRule } from "./definitions";

/**
 * A volume-class win — late included: ADR-0008 rule 2's exclusion list
 * names distributions, time stats, streak medals and Dia Perfeito, not
 * totals, and a late solve is honestly a solve. Spelled as the disjunction
 * of the two shared predicates so the on-time/late split keeps its single
 * producer in `stats.ts`.
 */
function countsAnyWon(row: StatsRow): boolean {
  return countsOnTimeWon(row) || countsLateWon(row);
}

/** The five computable kinds — `curated` is resolved against grants, never here. */
type ComputableRule = Exclude<MedalRule, { readonly kind: "curated" }>;

/** Pure. rows = the SAME listCompletionsForStats projection #29 ships
 *  (ADR-0049 D6, ADR-0051); grants = listMedalGrants' id list; today =
 *  the DB clock's SP day (todaySaoPaulo — never the client clock).
 *  Rows dated after `today` are excluded before any rule runs —
 *  defence-in-depth mirroring computeStreak's own `day <= todayDay`
 *  guard: a future-dated won row can never be the count-th row of a
 *  volume medal. hintsUsed and elapsedMs are present on StatsRow and
 *  consumed by NOTHING here — structurally inexpressible in MedalRule
 *  (handoff 034 §5). Output in catalog order (no date exists to sort by
 *  — ADR-0052/D6); deterministic; permutation-invariant in rows and
 *  grants. */
export function earnedMedals(
  rows: readonly StatsRow[],
  grants: readonly string[],
  today: string,
): readonly MedalId[] {
  const todayDay = epochDay(today);
  // The shared filter: rows dated after `today` count for NOTHING at all.
  const scoped = rows.filter((row) => epochDay(row.date) <= todayDay);

  // ONE shared streak sweep (ADR-0052/D10): walk the distinct counted
  // (on-time-won) dates once, computeStreak per date — the day-counting
  // predicate is never re-spelled — keeping the running maximum. Every
  // `streakReached` rule is then a threshold comparison against this one
  // value. "Reached" is monotone by construction: a later break never
  // shrinks the historical maximum. O(D·R) once per request, shared by
  // every streak medal; the revisit trigger and its arithmetic are
  // recorded in ADR-0052.
  const countedDates = new Set<string>();
  for (const row of scoped) {
    if (countsOnTimeWon(row)) {
      countedDates.add(row.date);
    }
  }
  let maxStreakReached = 0;
  for (const date of countedDates) {
    const { streak } = computeStreak(scoped, date);
    if (streak > maxStreakReached) {
      maxStreakReached = streak;
    }
  }

  // perfectDays is reused, never re-derived — on-time-only by that
  // function's own construction; a count, never a run length (ADR-0051).
  const perfectDayCount = perfectDays(scoped).length;

  // Grants are a SET: duplicate ids (impossible via the PK, defended
  // anyway) collapse. A grant naming a rule-derived or unknown id is
  // ignored — only `curated` definitions ever consult this set (ADR-0052).
  const grantSet = new Set(grants);

  function earnedByRule(rule: ComputableRule): boolean {
    switch (rule.kind) {
      case "totalWins":
        return (
          scoped.filter(
            (row) =>
              countsAnyWon(row) &&
              (rule.game === null || row.game === rule.game),
          ).length >= rule.count
        );
      case "streakReached":
        return maxStreakReached >= rule.days;
      case "perfectDaysReached":
        return perfectDayCount >= rule.count;
      case "termoGuessWins":
        // On-time won termo rows only: guess facts are distribution-class
        // statistics, and ADR-0008 rule 2 bars late completions from the
        // guess distribution.
        return (
          scoped.filter(
            (row) =>
              row.game === "termo" &&
              countsOnTimeWon(row) &&
              termoGuessOf(row) === rule.guesses,
          ).length >= rule.count
        );
      case "eachGameWon":
        // Volume class: any won row, late included.
        return GAMES.every((game) =>
          scoped.some((row) => row.game === game && countsAnyWon(row)),
        );
    }
  }

  return MEDAL_DEFINITIONS.filter((definition) =>
    definition.rule.kind === "curated"
      ? grantSet.has(definition.id)
      : earnedByRule(definition.rule),
  ).map((definition) => definition.id);
}
