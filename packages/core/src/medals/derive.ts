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

function countsAnyWon(row: StatsRow): boolean {
  return countsOnTimeWon(row) || countsLateWon(row);
}

type ComputableRule = Exclude<MedalRule, { readonly kind: "curated" }>;

export function earnedMedals(
  rows: readonly StatsRow[],
  grants: readonly string[],
  today: string,
): readonly MedalId[] {
  const todayDay = epochDay(today);
  const scoped = rows.filter((row) => epochDay(row.date) <= todayDay);

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
