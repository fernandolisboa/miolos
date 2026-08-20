export {
  COMPLETION_OUTCOMES,
  completionOutcomeSchema,
  HINT_GRANT_SOURCES,
  hintGrantSourceSchema,
  type CompletionOutcome,
  type HintGrantSource,
} from "./completion";
export { hasEntitlement, type Entitlements } from "./entitlements";
export {
  defaultFeatureFlags,
  isFeatureEnabled,
  type FeatureFlags,
} from "./feature-flags";
export {
  dateFromEpochDay,
  epochDay,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
} from "./date";
export {
  DAY_STATUSES,
  dayGamesFromRows,
  dayGameStateSchema,
  dayGameStatusSchema,
  dayStateFromRows,
  mergeDayState,
  mergeDayStatus,
  type DayGameState,
  type DayGameStatus,
  type DayRow,
  type DayState,
} from "./day";
export { GAMES, gameSchema, type Game } from "./game";
export { mergeCompletions, type MergeableCompletion } from "./merge";
export {
  computeCalendar,
  computeStats,
  perfectDays,
  TIME_BUCKET_BOUNDS_MS,
  timeBucketIndex,
  TIMED_GAMES,
  type CalendarDay,
  type CalendarDayState,
  type StatsRow,
  type StatsSummary,
  type TermoStats,
  type TimedGame,
  type TimedGameStats,
} from "./stats";
export {
  MEDAL_DEFINITIONS,
  MEDAL_IDS,
  type MedalDefinition,
  type MedalId,
  type MedalRule,
} from "./medals/definitions";
export { earnedMedals } from "./medals/derive";
// #58 (ADR-0066): the write-time on-time rule and its 1-day credit window.
// One caller — POST /completions; no read path re-derives on-time.
export {
  LATE_SYNC_CREDIT_DAYS_BACK,
  isWithinCreditWindow,
  onTimeAtWrite,
} from "./on-time";
export { computeStreak, type StreakRow, type StreakStatus } from "./streak";
export {
  defaultRemoteConfig,
  remoteConfigSchema,
  type RemoteConfig,
} from "./remote-config";
export { healthResponseSchema, type HealthResponse } from "./contracts/health";
export {
  apiRootResponseSchema,
  type ApiRootResponse,
} from "./contracts/api-root";
export {
  sessionResponseSchema,
  type SessionResponse,
} from "./contracts/session";
export {
  calendarDateString,
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,
  dailyPuzzleResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  isoDateString,
  nonogramSizeSchema,
  sudokuDigitSchema,
  type DailyBinairoResponse,
  type DailyNonogramResponse,
  type DailyPuzzleResponse,
  type DailySudokuResponse,
  type DailyTermoResponse,
  type NonogramSize,
  type ProjectedGame,
} from "./contracts/daily";
// SERVER-ONLY, and re-exported here rather than behind a subpath because the
// module is dropped from the client bundle by `"sideEffects": false` the
// moment nothing in a browser chunk names one of these. Do not import any of
// them from a client component (`./contracts/daily-content.ts` header).
export {
  binairoDailyContentSchema,
  DailyProjectionUnsupportedError,
  nonogramDailyContentSchema,
  stripDailyContent,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
  type BinairoDailyContent,
  type NonogramDailyContent,
  type SudokuDailyContent,
  type TermoDailyContent,
} from "./contracts/daily-content";
export {
  bufferDepthResponseSchema,
  cronPublishGameResultSchema,
  cronPublishResponseSchema,
  type BufferDepthResponse,
  type CronPublishGameResult,
  type CronPublishResponse,
} from "./contracts/cron";
export {
  TERMO_MAX_GUESSES,
  TERMO_WORD_LENGTH,
  termoGuessRequestSchema,
  termoGuessResponseSchema,
  termoGuessWordSchema,
  termoTilesSchema,
  termoTileStateSchema,
  type TermoGuessRequest,
  type TermoGuessResponse,
  type TermoTiles,
} from "./contracts/termo-guess";
export { dayResponseSchema, type DayResponse } from "./contracts/day";
export { streakResponseSchema, type StreakResponse } from "./contracts/streak";
export {
  calendarDayStateSchema,
  statsCalendarResponseSchema,
  statsResponseSchema,
  termoStatsSchema,
  timedGameStatsSchema,
  type StatsCalendarResponse,
  type StatsResponse,
} from "./contracts/stats";
export {
  apiErrorResponseSchema,
  binairoCompletionRequestSchema,
  completionRequestSchema,
  completionResponseSchema,
  nonogramCompletionRequestSchema,
  sudokuCompletionRequestSchema,
  termoCompletionRequestSchema,
  type ApiErrorResponse,
  type BinairoCompletionRequest,
  type CompletionRequest,
  type CompletionResponse,
  type NonogramCompletionRequest,
  type SudokuCompletionRequest,
  type TermoCompletionRequest,
} from "./contracts/completion";
export {
  attachConfirmResponseSchema,
  attachConfirmSchema,
  attachDismissResponseSchema,
  attachDismissSchema,
  attachEmailSchema,
  attachRequestResponseSchema,
  attachRequestSchema,
  attachStateResponseSchema,
  type AttachConfirmRequest,
  type AttachConfirmResponse,
  type AttachDismissRequest,
  type AttachDismissResponse,
  type AttachRequest,
  type AttachRequestResponse,
  type AttachStateResponse,
} from "./contracts/attach";
export {
  accountDeleteResponseSchema,
  accountDeleteSchema,
  type AccountDeleteRequest,
  type AccountDeleteResponse,
} from "./contracts/account";
export {
  medalIdSchema,
  medalsResponseSchema,
  type MedalsResponse,
} from "./contracts/medals";
export {
  onboardingSeenResponseSchema,
  onboardingSeenSchema,
  onboardingStateResponseSchema,
  type OnboardingSeenRequest,
  type OnboardingSeenResponse,
  type OnboardingStateResponse,
} from "./contracts/onboarding";
export {
  notificationsDismissResponseSchema,
  notificationsDismissSchema,
  notificationsStateResponseSchema,
  pushSubscribeResponseSchema,
  pushSubscribeSchema,
  pushUnsubscribeResponseSchema,
  pushUnsubscribeSchema,
  type NotificationsDismissRequest,
  type NotificationsDismissResponse,
  type NotificationsStateResponse,
  type PushSubscribeRequest,
  type PushSubscribeResponse,
  type PushUnsubscribeRequest,
  type PushUnsubscribeResponse,
} from "./contracts/notifications";
