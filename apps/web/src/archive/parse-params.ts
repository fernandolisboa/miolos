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

/**
 * The shape check ALONE is not enough, and the gap was an unauthenticated
 * 500 on a crawler-advertised route (#31 step-6 finding F2). `\d{4}` accepts
 * `0000`, `monthDayBounds("0000-01")` binds `0000-01-01`/`0000-01-31` into
 * `gte`/`lte` on a `date` column, and Postgres answers `date/time field value
 * out of range` (SQLSTATE 22008) — an unhandled throw in an async server
 * component, i.e. a 500, on the surface whose own doc block argues that a 500
 * is worse than a 404 in every dimension. It is the identical bug class this
 * repo already fixed once for the DAY segment: `calendarDateString`'s
 * `getUTCFullYear() >= 1` floor exists because of
 * `calendar-date-year-zero-500s-the-completions-route`.
 *
 * The fix runs the month's OWN first day through that same validator rather
 * than adding a second regex rule, so "a year that exists" keeps exactly one
 * definition in this repo. It also removes the only case where
 * `monthDayBounds` disagrees with the month it was asked about: `Date.UTC`
 * maps years 0–99 to 1900+year, and for years 1–99 the leap rule is
 * unchanged by that shift (1900 % 4 === 0 and no century falls in the range),
 * so year zero was the sole divergence.
 */
export function parseArchiveMonth(raw: string): string | undefined {
  const parsed = monthString.safeParse(raw);
  return parsed.success &&
    calendarDateString.safeParse(`${parsed.data}-01`).success
    ? parsed.data
    : undefined;
}

/**
 * The inclusive `[from, to]` day bounds of a validated month, derived in JS
 * from the month string alone and handed to the reader as two `YYYY-MM-DD`
 * values that reach SQL as `date` parameters.
 *
 * The last day is `day 0 of the NEXT month` under `Date.UTC`, which is the
 * one arithmetic that needs no leap-year table — and it is computed in UTC,
 * never in the host zone, for the reason `i18n/format.ts` gives at length.
 *
 * It takes a month `parseArchiveMonth` has already accepted, which is what
 * keeps `Date.UTC`'s years-0–99 remapping harmless here: year zero is
 * refused above, and every other two-digit year keeps its leap rule under
 * the +1900 shift.
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
