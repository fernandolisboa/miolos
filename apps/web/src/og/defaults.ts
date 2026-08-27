import { messages, ogLocale } from "../i18n";

export const OG_DEFAULTS = {
  type: "website",
  locale: ogLocale,
  siteName: messages.brand.wordmark,
} as const;
