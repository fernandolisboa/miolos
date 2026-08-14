import { calendarDateString } from "@miolos/core";
import { z } from "zod";

/**
 * The archive's segment parsers, and the ONE place either is spelled
 * (#31, ADR-0053 decision 1; plan 037 D6a).
 *
 * **Both `generateMetadata` AND the page body call these**, and that is the
 * whole point rather than a tidiness preference. In the App Router the two
 * resolve INDEPENDENTLY: a `notFound()` in the page does not stop the
 * metadata function from having already composed a canonical out of the raw
 * segment. On `/arquivo/mes/<hostile>` that canonical would be built from
 * attacker-controlled text, and a value beginning `//` or `https://`
 * resolves against `metadataBase` to an off-site absolute URL — canonical
 * poisoning, on the one surface in this product whose entire purpose is
 * being indexed. The month composer additionally reflects the string into an
 * indexable `<title>`.
 *
 * Parsed, never cast (CLAUDE.md's Zod-at-every-boundary rule). Both
 * anchoring regexes are safe in JS — `$` does not match before a trailing
 * newline, unlike Python — and no raw segment ever reaches SQL.
 */

/**
 * `YYYY-MM-DD`, and a real calendar day. `calendarDateString` is the repo's
 * ONE day validator: it round-trips through UTC and therefore rejects
 * `2026-02-30`, which a shape regex accepts. A hand-rolled regex here would
 * be a second spelling of "what a date is".
 */
export function parseArchiveDate(raw: string): string | undefined {
  const parsed = calendarDateString.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * `YYYY-MM`, month 01–12. There is no core validator for a month — a month
 * is not a calendar day and `calendarDateString` would reject it — so this
 * is the only shape check in the archive that is a regex, and it is
 * anchored.
 */
const monthString = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "expected YYYY-MM");

export function parseArchiveMonth(raw: string): string | undefined {
  const parsed = monthString.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The inclusive `[from, to]` day bounds of a validated month, derived in JS
 * from the month string alone and handed to the reader as two `YYYY-MM-DD`
 * values that reach SQL as `date` parameters.
 *
 * The last day is `day 0 of the NEXT month` under `Date.UTC`, which is the
 * one arithmetic that needs no leap-year table — and it is computed in UTC,
 * never in the host zone, for the reason `i18n/format.ts` gives at length.
 */
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

/**
 * The month a `YYYY-MM-DD` belongs to — a string slice, never a `Date`.
 * `listArchivedMonths` returns exactly this shape, so the day page's link up
 * to its month needs no second round trip.
 */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}
