/**
 * Medal derivation (ADR-0052). Rule-derived medals recompute from
 * completion rows on every read — nothing is stored for them; only
 * `curated` medals consult stored grants.
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

/** A volume-class win, late included — totals count a late solve; the
 *  distribution, streak and perfect-day classes below do not (ADR-0008 rule 2). */
function countsAnyWon(row: StatsRow): boolean {
  return countsOnTimeWon(row) || countsLateWon(row);
}

/** The five computable kinds — `curated` is resolved against grants, never here. */
type ComputableRule = Exclude<MedalRule, { readonly kind: "curated" }>;

/**
 * `today` is the DB clock's Sao Paulo day (`todaySaoPaulo`), NEVER the client
 * clock — a caller-side rule no test in this package can reach, because the
 * caller lives in `apps/api`.
 */
export function earnedMedals(
  rows: readonly StatsRow[],
  grants: readonly string[],
  today: string,
): readonly MedalId[] {
  const todayDay = epochDay(today);
  const scoped = rows.filter((row) => epochDay(row.date) <= todayDay);

  // One shared streak sweep: walk the distinct counted (on-time-won) dates
  // once, computeStreak per date, keep the running maximum. Every
  // `streakReached` rule is then a threshold comparison against this one
  // value — "reached" is monotone, so a later break never shrinks it.
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
    // 365 is the largest `streakReached` threshold in the catalog: once
    // reached, further iterations cannot change any rule's answer.
    if (maxStreakReached >= 365) {
      break;
    }
  }

  const perfectDayCount = perfectDays(scoped).length;
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
        return (
          scoped.filter(
            (row) =>
              row.game === "termo" &&
              countsOnTimeWon(row) &&
              termoGuessOf(row) === rule.guesses,
          ).length >= rule.count
        );
      case "eachGameWon":
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
