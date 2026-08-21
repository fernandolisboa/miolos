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
  // #58 (ADR-0066): the multi-past-date guard's read — the widening
  // tripwire POST /completions consults before storing a past-date credit.
  hasCreditedPastDateToday,
  // #83 (ADR-0060): the day-truth reader — one user, one SP day, <= 4 rows
  // on `completions_user_date_idx`, the index built for this read.
  listCompletionsForDay,
  listCompletionsForStreak,
  recordCompletion,
  type CompletionRecord,
} from "./completions";
// #58 (ADR-0066): the seen-days statements — presence recorded by the
// session service's three hooks, consulted ONLY by POST /completions'
// write-time credit, pruned by /cron/publish. The table itself is NOT
// exported: no consumer outside seen-days.ts and mergeAccounts names it.
export { pruneSeenDays, recordSeenDay, wasSeenOn } from "./seen-days";
// Live since #21 (the magic-link confirm route is the first production
// caller): the ADR-0009 merge operation, its read-only preview reader, and
// the winner-liveness guard's error predicate (the confirm route retries
// on that throw and ONLY that throw — anything else is a loud 500).
export {
  isWinnerLivenessError,
  listCompletionsForMerge,
  mergeAccounts,
} from "./merge";
// The #29 statistics readers (plan 033, ADR-0051): the unfiltered
// per-user projection the core derivations (and #30's shipped medals,
// ADR-0049 decision 6) recompute over, and the account's SP birth day —
// the calendar's range anchor.
export { getUserSince, listCompletionsForStats } from "./stats";
// The #30 curated-grant reader (ADR-0052): the grants input to
// earnedMedals — rule-derived medals recompute over the stats reader
// above and are never stored.
export { listMedalGrants } from "./medals";
// #146 (ADR-0064, ADR-0068): the dispatcher's statements — the candidate
// read, the claim-first ledger write, and the one-snapshot tick instant.
// Cross-table, so they live in packages/db (the merge.ts rule); the
// `pruneSeenDays` precedent already puts a cron-side duty on this entry.
export {
  claimNudgeSend,
  listPushNudgeCandidates,
  readTickInstant,
} from "./notify";
// `attachTokens` (#21, ADR-0050): user-scoped like completions — the
// statements over it live in apps/api/src/attach/service.ts, and apps/web
// mechanically cannot name it through the root entry (ADR-0026 decision 5).
// `notificationSends` (#146): the ledger table, USER entry only — apps/web
// must not be able to name it; the schema-pin test is its named reader.
export {
  attachTokens,
  completions,
  hintGrants,
  medalGrants,
  notificationSends,
} from "./schema";
