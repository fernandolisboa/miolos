export {
  formatDayNumber,
  formatElapsed,
  formatLongDate,
  formatMonth,
  formatShortDate,
} from "./format";
export { locale, ogLocale } from "./locale";
export { SAO_PAULO_TIME_ZONE, todaySaoPauloDate } from "./sao-paulo-day";
// `medalCopy` (#30, ADR-0052) deliberately does NOT ride this barrel: it
// lives in `src/medals/copy.ts`, imported only by the medal section —
// re-exporting it here would put its prose in the module graph of every
// route that touches i18n (plan 035 §14 watch item 2, measured).
export { messages, type Messages } from "./messages";
export {
  archiveDayRoute,
  archiveGameRoute,
  archiveMonthRoute,
  freePlayRoutes,
  playRoutes,
  routes,
  routeSlugs,
  type Route,
  type RouteSlug,
} from "./routes";
