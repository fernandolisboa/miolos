/**
 * Test-only helpers behind the `@miolos/core/testing` subpath — never part
 * of the runtime surface. Single source for the ADR-0004 leak-scan probe
 * used by suites across packages/core, packages/db and apps/api.
 */

/**
 * Keys that must never appear at any depth of a client-facing daily payload.
 * Also a substring ban on three `apps/web` page suites' rendered markup —
 * adding a member constrains both the payload shape and that markup.
 *
 * `"name"` stays banned even though the daily Nonogram conclusion publishes
 * `motifName` (ADR-0070): the field is deliberately spelled with a capital
 * `N` so it is not a substring of the banned lowercase `"name"`. A payload
 * that needs a name renames its field rather than lifting the ban.
 */
export const FORBIDDEN_DAILY_KEYS = [
  "solution",
  "seed",
  "reveal",
  "answer",
  "clueCount",
  "motifId",
  "name",
  "mirrored",
  // Termo's stored content is `{canonical, normalized}` (ADR-0040) — both
  // keys carry the answer, so `"answer"` alone would miss a flattened
  // projection. `"canonical"` is also a generic word Next.js uses for SEO
  // (`<link rel="canonical">`); an unrelated SEO change tripping this scan
  // is a known, accepted cost of the ban.
  "canonical",
  "normalized",
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
