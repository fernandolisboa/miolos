import { calendarDateString } from "@miolos/core";
import { z } from "zod";

export function parseArchiveDate(raw: string): string | undefined {
  const parsed = calendarDateString.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

const monthString = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "expected YYYY-MM");

export function parseArchiveMonth(raw: string): string | undefined {
  const parsed = monthString.safeParse(raw);
  return parsed.success &&
    calendarDateString.safeParse(`${parsed.data}-01`).success
    ? parsed.data
    : undefined;
}

export function monthDayBounds(month: string): {
  readonly from: string;
  readonly to: string;
} {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}
