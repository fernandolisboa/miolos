/**
 * Today's São Paulo calendar day, 'YYYY-MM-DD' — ONE spelling, two callers
 * (step-6 F7's hoist): the hub page and the stats calendar's settled-null
 * branch.
 *
 * On the hub it is the key the day state is read under (ADR-0031 as amended
 * by ADR-0060 — since #83 that state is this device's AND the server's, and
 * this date is also what the server payload's own `date` must equal before
 * the merge will look at it), and the same day `/binairo` and `/sudoku`
 * resolve from the
 * published-puzzle wall — derived from the SERVER's clock, on a
 * `force-dynamic` segment: the browser's clock never selects which day the
 * hub is showing (CONTEXT.md "Rollover").
 *
 * `now` is the caller's, always: WHOSE clock feeds this function is the
 * whole invariant, and the boundary is worth stating once, here
 * (ADR-0051's consequence). The single legal DEVICE-clock call site in the
 * app is the stats calendar's settled-null neutral month title — a
 * presentation-only reading that claims no state for any day, selects no
 * record and backs no derived value. Any new caller passing a client-side
 * `new Date()` must clear that same bar; the code alone is not the
 * precedent, the reasoning is.
 *
 * Assembled from the typed parts rather than from a formatted string,
 * because `locale` is pt-BR and would print 31/07/2026; the parts are
 * numeric in every locale, so no second locale is introduced for a
 * machine-readable value. A missing part cannot happen for these options,
 * and if it ever did the date would simply match no stored record and
 * every consumer would fall to its honest empty state — the monotone-safe
 * direction (ADR-0031).
 */
import { locale } from "./locale";

/**
 * The day's rollover, fixed for every user (CONTEXT.md "Rollover").
 * Declared here rather than imported from `@miolos/db`: this module reads
 * no database, and pulling the driver in for a string would be a real cost.
 */
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

export function todaySaoPauloDate(now: Date): string {
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).formatToParts(now);
  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}
