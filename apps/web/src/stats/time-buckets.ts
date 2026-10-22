import { TIME_BUCKET_BOUNDS_MS, type TimedGame } from "@miolos/core";

import { messages } from "../i18n";

export interface TimeBucket {
  readonly label: string;
  readonly name: string;
}

export function timeBuckets(game: TimedGame): readonly TimeBucket[] {
  const { label, name } = messages.stats.histogram;
  const [first, ...rest] = TIME_BUCKET_BOUNDS_MS[game];
  let from = first / 60_000;
  const buckets: TimeBucket[] = [
    { label: label.under(from), name: name.under(from) },
  ];
  for (const bound of rest) {
    const to = bound / 60_000;
    buckets.push({
      label: label.between(from, to),
      name: name.between(from, to),
    });
    from = to;
  }
  buckets.push({ label: label.over(from), name: name.over(from) });
  return buckets;
}
