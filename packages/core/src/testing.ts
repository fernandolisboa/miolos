/**
 * Test-only helpers behind the `@miolos/core/testing` subpath — never part
 * of the runtime surface. Single source for the ADR-0004 leak-scan probe
 * used by the suites in packages/core, packages/db and apps/api, so
 * extending the forbidden set for a new game lands in every suite at once.
 */

/**
 * Keys that must never appear at ANY depth of a client-facing daily
 * payload. #23/#25/#27 extend this list with their games'
 * solution-adjacent fields (e.g. sudoku clue metadata, the termo answer)
 * when their projections land.
 */
export const FORBIDDEN_DAILY_KEYS = [
  "solution",
  "seed",
  "reveal",
  "answer",
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
