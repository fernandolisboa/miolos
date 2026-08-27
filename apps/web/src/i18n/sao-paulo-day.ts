import { locale } from "./locale";

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

export function todaySaoPauloDate(now: Date): string {
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).formatToParts(now);
  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}
