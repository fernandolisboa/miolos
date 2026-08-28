const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function epochDay(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new RangeError(`expected 'YYYY-MM-DD', got ${JSON.stringify(date)}`);
  }
  const year = Number(match[1]);

  if (year < 1000) {
    throw new RangeError(
      `expected a year >= 1000, got ${JSON.stringify(date)}`,
    );
  }
  return Date.UTC(year, Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

export const MIN_EPOCH_DAY = epochDay("1000-01-01");
export const MAX_EPOCH_DAY = epochDay("9999-12-31");

export function dateFromEpochDay(day: number): string {
  if (!Number.isInteger(day) || day < MIN_EPOCH_DAY || day > MAX_EPOCH_DAY) {
    throw new RangeError(
      `expected an integer epoch day in [${String(MIN_EPOCH_DAY)}, ${String(
        MAX_EPOCH_DAY,
      )}], got ${String(day)}`,
    );
  }
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}
