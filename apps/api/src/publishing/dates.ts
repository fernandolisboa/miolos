export const ROLLOVER_SLACK_DAYS = 1;

export function isWritableDate(date: string, today: string): boolean {
  return date <= today;
}

export function isLateDate(date: string, today: string): boolean {
  return date < today;
}
