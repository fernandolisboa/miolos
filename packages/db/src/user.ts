/**
 * User-scoped exports only, reachable through `@miolos/db/user` and never
 * the root entry — apps/web cannot import this module.
 */
export {
  getCompletion,
  grantedHintsToday, // dormant, no v1 writer (ADR-0027)
  grantHints, // dormant, no v1 writer (ADR-0027)
  hasCreditedPastDateToday,
  listCompletionsForDay,
  listCompletionsForStreak,
  recordCompletion,
  type CompletionRecord,
} from "./completions";
export { pruneSeenDays, recordSeenDay, wasSeenOn } from "./seen-days";
export {
  isWinnerLivenessError,
  listCompletionsForMerge,
  mergeAccounts,
} from "./merge";
export { getUserSince, listCompletionsForStats } from "./stats";
export { listMedalGrants } from "./medals";
export {
  claimNudgeSend,
  listPushNudgeCandidates,
  readTickInstant,
} from "./notify";
export {
  attachTokens,
  completions,
  hintGrants,
  medalGrants,
  notificationSends,
} from "./schema";
