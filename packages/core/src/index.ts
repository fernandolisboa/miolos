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
export { GAMES, gameSchema, type Game } from "./game";
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
