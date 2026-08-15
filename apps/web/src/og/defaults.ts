import { messages, ogLocale } from "../i18n";

/**
 * The three `og:` members every leaf declaration must re-declare (#34,
 * ADR-0054 decision 11).
 *
 * **A leaf `openGraph` REPLACES the root layout's — Next does not deep-merge
 * it across segments, the nearest declaration wins whole.** Verified on a
 * Turbopack production build of a throwaway Next 16.2.12 app carrying exactly
 * this root layout:
 *
 * ```
 * /semog       (no leaf openGraph)                  → og:title og:description
 *                                                     og:site_name og:locale og:type  ✓
 * /jogo        (leaf openGraph:{title,description}) → og:title og:description og:image
 *                                                     NO og:type, NO og:locale,
 *                                                     NO og:site_name                 ✗
 * /ogdefaults  (leaf openGraph:{...OG_DEFAULTS,…})  → all three restored              ✓
 * ```
 *
 * So without the spread the routes keeping the full card would be exactly the
 * ones that get the GENERIC card, and the eight routes #34 exists for would
 * lose it. `T-WEB-S198`/`S199` assert the three members on a LEAF route for
 * that reason — asserting them on the root layout passes while every share
 * target lacks them.
 *
 * **`pt_BR` carries an UNDERSCORE, and it must not be "fixed".** The Open
 * Graph protocol's `og:locale` is `language_TERRITORY`; `<html lang>` is
 * BCP-47 with a hyphen. `src/i18n/locale.ts` exports both — `locale` for
 * `<html lang>` (`app/layout.tsx`) and `ogLocale` for this — as **two
 * constants that must never be derived from each other**, which is what
 * `T-WEB-S199` asserts. Both live in `src/i18n/` because ADR-0018's decision
 * bullet 3 externalizes locale tags there; the literal used to sit in this
 * file, which was the one part of the rule #34 missed (step-6 finding W4).
 */
export const OG_DEFAULTS = {
  type: "website",
  locale: ogLocale,
  siteName: messages.brand.wordmark,
} as const;
