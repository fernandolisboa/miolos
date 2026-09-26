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
  type DayClaimExtras,
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
  cronNotifyResponseSchema,
  cronPublishGameResultSchema,
  cronPublishResponseSchema,
  type BufferDepthResponse,
  type CronNotifyResponse,
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
  accountDetachEmailResponseSchema,
  accountDetachEmailSchema,
  accountStateResponseSchema,
  reminderConsentResponseSchema,
  reminderConsentSchema,
  type AccountDeleteRequest,
  type AccountDeleteResponse,
  type AccountDetachEmailRequest,
  type AccountDetachEmailResponse,
  type AccountStateResponse,
  type ReminderConsentRequest,
  type ReminderConsentResponse,
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
  pushNudgePayloadSchema,
  pushSubscribeResponseSchema,
  pushSubscribeSchema,
  pushUnsubscribeResponseSchema,
  pushUnsubscribeSchema,
  streakReminderSchema,
  type NotificationsDismissRequest,
  type NotificationsDismissResponse,
  type NotificationsStateResponse,
  type PushNudgePayload,
  type PushSubscribeRequest,
  type PushSubscribeResponse,
  type PushUnsubscribeRequest,
  type PushUnsubscribeResponse,
  type StreakReminder,
} from "./contracts/notifications";
export {
  TELEMETRY_EVENTS,
  telemetryEventPropertiesSchemas,
  telemetryRelayRequestSchema,
  type TelemetryEvent,
  type TelemetryEventProperties,
  type TelemetryRelayRequest,
} from "./contracts/telemetry";
