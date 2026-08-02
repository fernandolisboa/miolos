/**
 * Test-only helpers behind the `@miolos/core/testing` subpath — never part
 * of the runtime surface. Single source for the ADR-0004 leak-scan probe
 * used by the suites in packages/core, packages/db and apps/api, so
 * extending the forbidden set for a new game lands in every suite at once.
 */

/**
 * Keys that must never appear at ANY depth of a client-facing daily
 * payload. #27 extends this list with termo's answer when its projection
 * lands.
 *
 * `clueCount` is sudoku's, added by #23: it appears in no shipped payload,
 * so every landed scan kept passing unchanged — adding it is what makes
 * the scan meaningful for the game whose content actually carries it
 * (plan 018 S22).
 *
 * TWO HALVES, not one. All ten consumers scan KEYS (`collectKeys` below),
 * and `apps/web`'s THREE page suites — `binairo-page.test.tsx`,
 * `sudoku-page.test.tsx`, `nonogram-page.test.tsx` — additionally assert
 * `expect(renderToStaticMarkup(element)).not.toContain(forbidden)`. So a
 * member of this list is also a SUBSTRING banned from those pages'
 * rendered HTML — for `"name"` that means no lowercase `name` anywhere in
 * `/binairo`'s, `/sudoku`'s or `/nonogram`'s markup, a `<meta name>`, an
 * `<input name>` and a lowercase `name*` CSS-module local included
 * (ADR-0033, plan 020 §7.7). Adding a member is a standing constraint on
 * every future daily payload AND on that markup.
 */
export const FORBIDDEN_DAILY_KEYS = [
  "solution",
  "seed",
  "reveal",
  "answer",
  "clueCount",
  // #25 (ADR-0033): the nonogram reveal's identity. `name` is a GENERIC key
  // and that is deliberate — no daily payload has ever carried one, and this
  // decision is the reason none may. A future payload that genuinely needs a
  // `name` renames its field or amends this list with a written reason.
  "motifId",
  "name",
  "mirrored",
] as const;

/** Every key at any depth of a JSON-shaped value (the leak-scan probe). */
export function collectKeys(
  value: unknown,
  into: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, into);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key);
      collectKeys(nested, into);
    }
  }
  return into;
}
