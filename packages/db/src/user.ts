/**
 * User-scoped surface (ADR-0026, plan 017 D17). Completions and hint
 * grants carry no puzzle content, so they are not behind the ADR-0004
 * wall — but every write and every user-specific read belongs to
 * apps/api without exception (ADR-0007/ADR-0014). Keeping them off the
 * root entry makes that mechanical: apps/web imports `@miolos/db` and
 * therefore cannot name these tables at all.
 *
 * The export list below is pinned exactly by the tripwire in
 * test/user.test.ts — widening this surface fails the suite.
 */
export {
  getCompletion,
  grantedHintsToday, // DORMANT (plan 017 D22) — no v1 writer; see ADR-0027
  grantHints, // DORMANT (plan 017 D22)
  listCompletionsForStreak,
  recordCompletion,
  type CompletionRecord,
} from "./completions";
// Live since #21 (the magic-link confirm route is the first production
// caller): the ADR-0009 merge operation and its read-only preview reader.
export { listCompletionsForMerge, mergeAccounts } from "./merge";
// `attachTokens` (#21, ADR-0050): user-scoped like completions — the
// statements over it live in apps/api/src/attach/service.ts, and apps/web
// mechanically cannot name it through the root entry (ADR-0026 decision 5).
export { attachTokens, completions, hintGrants } from "./schema";
