import { messages, ogLocale } from "../i18n";

/**
 * The three `og:` members every leaf declaration must re-declare (#34,
 * ADR-0054 decision 11).
 *
 * **A leaf `openGraph` REPLACES the root layout's — Next does not deep-merge
 * it across segments, the nearest declaration wins whole.**
 * So without the spread the routes keeping the full card would be exactly the
 * ones that get the GENERIC card, and the eight routes #34 exists for would
 * lose it.
 *
 * **`pt_BR` carries an UNDERSCORE, and it must not be "fixed".** The Open
 * Graph protocol's `og:locale` is `language_TERRITORY`; `<html lang>` is
 * BCP-47 with a hyphen. `src/i18n/locale.ts` exports both — `locale` for
 * `<html lang>` (`app/layout.tsx`) and `ogLocale` for this — as **two
 * constants that must never be derived from each other**, which is what
 * `T-WEB-S199` asserts.
 */
export const OG_DEFAULTS = {
  type: "website",
  locale: ogLocale,
  siteName: messages.brand.wordmark,
} as const;
