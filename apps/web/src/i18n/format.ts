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

// `formatDayInMonth` ("31 · segunda-feira") went with the day rows that
// were its only consumer (#163): the calendar's cells carry the bare
// numeral (`formatDayNumber` below), and the weekday moved into each
// link's accessible name, composed whole in
// `messages.archive.calendar.dayAria` from its `weekdaysLong` tuple.

/**
 * "31" — the archive stamp's postmark figure (#31 step-6 finding F7), and
 * since #163 the archive calendar's cell numerals. The stamp is the lone
 * numeral ADR-0036 decision 2 leaves on Fraunces; the calendar's grid of
 * numerals is decision 1's aligning case, and its stylesheet puts the
 * cells on `--font-ui` + `tabular-nums` — the face is the CALLER's call,
 * this function only spells the figure. Through `Intl` rather than a
 * string slice, so the locale owns its own numerals and the leading zero
 * goes without a hand-rolled trim.
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
 * THE RUNNING READOUT NO LONGER SHIFTS ON EVERY TICK, as of #63.
 * `TimerReadout`'s two live callers — `play/screen.module.css`'s `.timerBar`
 * (20 px) and `.timerCard` (30 px) — carry `font-family: var(--font-ui)` with
 * `font-variant-numeric: tabular-nums`, which is ADR-0036 decision 1: the face
 * that can actually satisfy the feature. Instrument Sans collapses every digit
 * to one advance (6.609375 px at 11 px, spread 0.000000), so a changing digit
 * moves nothing to its right. The conclusion's `.stampTime` stays on Fraunces
 * and that is not an oversight: it renders a frozen value, which is decision
 * 2's single non-aligning numeral.
 *
 * The history matters because this TSDoc has been wrong in both directions.
 * It first asserted "rendered with tabular-nums by every caller (tokens.css
 * mandates it for timers) so the digits do not jitter" — false, on the exact
 * surfaces ADR-0036 measures at ≈6.1 px per digit at 30 px (step-6 round-4
 * finding `ADR-0036-UNAMENDED-LINES`). #25 then corrected it to state the
 * defect, because ADR-0036 decision 5 deliberately left the face change to
 * #63. #63 made the change, so the statement of the defect became the false
 * one and is replaced here. `T-WEB-S230` is the gate that keeps this
 * paragraph true.
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
