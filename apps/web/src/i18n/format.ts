import { locale } from "./locale";

function utcNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

const longDateFormat = new Intl.DateTimeFormat(locale, {
  dateStyle: "long",
  timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat(locale, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayAndMonthFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const shortDateFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayNumberFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  timeZone: "UTC",
});

export function formatLongDate(isoDate: string): string {
  return longDateFormat.format(utcNoon(isoDate));
}

export function formatMonth(isoDate: string): string {
  return monthFormat.format(utcNoon(isoDate));
}

export function formatDayAndMonth(isoDate: string): string {
  return dayAndMonthFormat.format(utcNoon(isoDate));
}

export function formatShortDate(isoDate: string): string {
  const parts = shortDateFormat.formatToParts(utcNoon(isoDate));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${day} ${month.replace(/\.$/, "")}`.trim();
}

export function formatDayNumber(isoDate: string): string {
  return dayNumberFormat.format(utcNoon(isoDate));
}

export function formatElapsed(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
