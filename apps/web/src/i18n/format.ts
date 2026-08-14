/**
 * Presentation formatters for the dates and durations the game screens
 * show (plan 017 §13.3). They live with the strings because their output
 * IS copy: the locale comes from `i18n/locale.ts`, never a literal, and
 * every caller passes a value it already holds — no formatter here reads a
 * clock.
 *
 * The date functions take the PUZZLE's `YYYY-MM-DD`, which the server
 * derived from the database clock (ADR-0010). They build the instant as
 * UTC noon of that calendar day and format it in UTC: noon is far enough
 * from either edge that no rounding can move it, and formatting in the
 * same zone it was built in means the rendered day is the given day under
 * any host timezone. `new Date(isoDate)` + the host zone would render the
 * day before for every player west of Greenwich — the exact rollover bug
 * CLAUDE.md's timezone invariant exists to prevent.
 */
import { locale } from "./locale";

/** UTC noon of `isoDate`, the anchor both date formatters share. */
function utcNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

// The three `Intl.DateTimeFormat` instances live at module scope: locale
// and options are module constants, and construction is the expensive
// part (measured at step 6: a per-call construct ran ~40× per calendar
// render, 160–260 ms on a mid-range phone). `format` on a shared
// instance is cheap and stateless.
const longDateFormat = new Intl.DateTimeFormat(locale, {
  dateStyle: "long",
  timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat(locale, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayInMonthFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  weekday: "long",
  timeZone: "UTC",
});

const dayNumberFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  timeZone: "UTC",
});

/** "30 de julho de 2026" — formats the PUZZLE's date, never `new Date()`. */
export function formatLongDate(isoDate: string): string {
  return longDateFormat.format(utcNoon(isoDate));
}

/**
 * "agosto de 2026" — the stats calendar's month title (#29). Takes the
 * month's first day as 'YYYY-MM-01' and rides the same `utcNoon` anchor as
 * its two siblings, so it inherits their UTC-noon reasoning wholesale: no
 * new date arithmetic, no host-timezone rollover.
 */
export function formatMonth(isoDate: string): string {
  return monthFormat.format(utcNoon(isoDate));
}

/**
 * "30 jul" — the mobile top bar. Composed from `formatToParts` rather than
 * a format string because pt-BR's own short form is "30 de jul.": the
 * connective and the abbreviation's full stop are both literal parts we
 * drop, and neither can be removed from the formatted string safely.
 */
export function formatShortDate(isoDate: string): string {
  const parts = shortDateFormat.formatToParts(utcNoon(isoDate));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${day} ${month.replace(/\.$/, "")}`.trim();
}

/**
 * "31 · segunda-feira" — a day row INSIDE a month page (#31 step-6 finding
 * F9). The month page's `<h1>` already states the month and the year, so
 * `formatLongDate` printed them again in every one of up to 31 rows: month
 * and year repeated verbatim below a heading that had just said them, the
 * only varying token was the leading day number, and it was not the visual
 * anchor. This leaves month and year to the heading and to the index's rows,
 * where they are the varying part.
 *
 * Composed from `formatToParts` for `formatShortDate`'s reason: pt-BR's own
 * combined form is "segunda-feira, 31", weekday first, and the day number is
 * what a reader scans a month page by.
 */
export function formatDayInMonth(isoDate: string): string {
  const parts = dayInMonthFormat.formatToParts(utcNoon(isoDate));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  return `${day} · ${weekday}`.trim();
}

/**
 * "31" — the archive stamp's postmark figure (#31 step-6 finding F7). A lone
 * numeral, which is exactly the case ADR-0036 decision 2 leaves on Fraunces:
 * it never has to line up with another. Through `Intl` rather than a string
 * slice, so the locale owns its own numerals and the leading zero goes
 * without a hand-rolled trim.
 */
export function formatDayNumber(isoDate: string): string {
  return dayNumberFormat.format(utcNoon(isoDate));
}

/**
 * "04:32" / "1:04:32" — the count-up readout. Total milliseconds in, no
 * `Date` involved: elapsed time is a duration, and treating it as an
 * instant is how timezone bugs get into a stopwatch. The hours field
 * appears only once there is an hour to show, so the common case stays
 * the two-field clock the frames draw.
 *
 * THE RUNNING READOUT DOES SHIFT ON EVERY TICK, and this says so rather than
 * claiming otherwise (ADR-0036 decision 5, issue #63). `TimerReadout`'s two
 * live callers are `play/screen.module.css`'s `.timerBar` (20 px) and
 * `.timerCard` (30 px), both `font-family: var(--font-display)` — Fraunces,
 * which has NO tabular figures and responds to no OpenType feature tag, so
 * their `font-variant-numeric: tabular-nums` is a measured no-op and the
 * digits move by ≈6.1 px each at 30 px. The conclusion's `.stampTime` renders
 * a frozen value, so the same face costs nothing there.
 *
 * This TSDoc used to assert the opposite — "rendered with tabular-nums by
 * every caller (tokens.css mandates it for timers) so the digits do not
 * jitter" — on the exact surfaces the ADR measures as jittering (step-6
 * round-4 finding `ADR-0036-UNAMENDED-LINES`). The fix is a face change on
 * two shipped screens and is #63's, not this ticket's.
 */
export function formatElapsed(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
