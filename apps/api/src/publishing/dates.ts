const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const ROLLOVER_SLACK_DAYS = 1;

export function isWritableDate(date: string, today: string): boolean {
  return date <= today;
}

export function isLateDate(date: string, today: string): boolean {
  return date < today;
}

function partsOf(date: string): [number, number, number] {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new RangeError(`expected 'YYYY-MM-DD', got ${JSON.stringify(date)}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = partsOf(date);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function isoWeekdayOf(date: string): number {
  const [year, month, day] = partsOf(date);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}
