// Reduced per-pull-request sample of the ADR-0023 property floor; the full
// proof runs nightly under MIOLOS_FULL_PROPERTIES=1. See ADR-0059.
//
// Must stay in test/, not src/: purity.test.ts scans src/** for import
// specifiers and does not check `process.env` usage, so moving this file
// there would breach the package's zero-Node invariant silently.

/**
 * `true` only for the exact string `"1"` — fails closed, so neither
 * `MIOLOS_FULL_PROPERTIES=0` nor an unrecognised value buys the full proof.
 */
export const FULL_PROPERTIES = process.env.MIOLOS_FULL_PROPERTIES === "1";

// 25: sized for full weekday coverage of the sudoku criteria table (21 runs)
// plus margin. See ADR-0059 for the derivation; lowering it is not a
// performance lever — generate.test.ts asserts the coverage floor.
export const PR_GATE_RUNS = 25;

export function propertyRuns(full: number): number {
  return FULL_PROPERTIES ? full : Math.min(full, PR_GATE_RUNS);
}
