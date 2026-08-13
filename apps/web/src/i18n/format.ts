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

/** "30 de julho de 2026" — formats the PUZZLE's date, never `new Date()`. */
export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(utcNoon(isoDate));
}

/**
 * "agosto de 2026" — the stats calendar's month title (#29). Takes the
 * month's first day as 'YYYY-MM-01' and rides the same `utcNoon` anchor as
 * its two siblings, so it inherits their UTC-noon reasoning wholesale: no
 * new date arithmetic, no host-timezone rollover.
 */
export function formatMonth(isoDate: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcNoon(isoDate));
}

/**
 * "30 jul" — the mobile top bar. Composed from `formatToParts` rather than
 * a format string because pt-BR's own short form is "30 de jul.": the
 * connective and the abbreviation's full stop are both literal parts we
 * drop, and neither can be removed from the formatted string safely.
 */
export function formatShortDate(isoDate: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatToParts(utcNoon(isoDate));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${day} ${month.replace(/\.$/, "")}`.trim();
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
