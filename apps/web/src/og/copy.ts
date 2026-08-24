import { messages } from "../i18n";

/**
 * Open Graph copy (#34, ADR-0054 decisions 7 and 10). Two kinds.
 *
 * HOMED HERE RATHER THAN IN `src/i18n/messages.ts`, and that is a bundle
 * decision, not a filing one. It is `src/medals/copy.ts`'s
 * recorded precedent applied to a second deck: bundlers do not eliminate
 * unused PROPERTIES of an object literal, only unused exports, so as a member
 * of `messages` this ~300-350 bytes of server-only prose rode into the client
 * chunk of every route that imports `messages` for anything at all — which is
 * every route.
 *
 * Two rules keep it that way, both of them the medals module's:
 *   - **the i18n barrel must never re-export this**, and
 *   - `messages.ts` must never import it.
 * Either edge puts the prose back on every route.
 *
 * `altGame` is the image route's static `alt` export, and it is DATELESS by
 * constraint rather than by choice: `alt` is a module export on a metadata
 * route and cannot read `params`, so there is no date to put in it.
 *
 * The four `daily*` pairs are the ONLY metadata the daily play routes carry.
 * They are deliberately not page `title`/`description`: those stay inherited
 * from the root layout, which is what keeps ADR-0028 `:37-39`'s "the daily
 * routes are not an SEO surface" literally true (ADR-0054 decision 10). The
 * archive PLAY routes add no copy at all — they reuse the
 * `messages.archive.meta` strings they already compose.
 */
export const ogCopy = {
  altGame: (name: string) => `Cartão do ${messages.brand.wordmark} — ${name}`,
  altSite: `Cartão do ${messages.brand.wordmark}`,
  /**
   * The SITE card's second line, under the wordmark. Written here rather
   * than derived from `meta.title` or `meta.description` by string surgery:
   * `meta.title` already contains the wordmark the card renders at 96px, so
   * reusing it would print the brand twice, and `meta.description` is 133
   * characters — three wrapped lines of 39px body copy where the composition
   * wants one tagline.
   */
  siteTagline: "Quatro jogos de raciocínio por dia.",
  /**
   * The ARCHIVE INDEX card's second line (#104, ADR-0071). The index card is
   * the one of the three with no date to print, so the caption slot holds a
   * tagline instead.
   *
   * **This is the SHIPPED sentence, not a new one.** It is the first sentence
   * of `messages.archive.lead`, already rendered on `/arquivo` — the very
   * page this card serves. Minting a second wording of one claim is what
   * `messages.ts` polices in its own words — *"a second copy is how two
   * screens drift apart"* — and the two would sit on the same surface.
   */
  archiveTagline: "Todos os puzzles do dia desde o começo.",
  /**
   * The ARCHIVE DAY card's caption line — the year the display line dropped,
   * and the section it belongs to.
   */
  archiveDayCaption: (year: string) => `de ${year} · ${messages.archive.title}`,
  /**
   * The three archive cards' `alt` strings.
   *
   * The other two are DATED, which `altGame` cannot be: they are carried by
   * an `images[].alt` composed inside `generateMetadata`, which reads
   * `params`, rather than by a metadata route's static module export.
   */
  altArchiveIndex: `Cartão do ${messages.brand.wordmark} — ${messages.archive.title}`,
  altArchiveDay: (longDate: string) =>
    `Cartão do ${messages.brand.wordmark} — puzzles de ${longDate}`,
  altArchiveMonth: (month: string) =>
    `Cartão do ${messages.brand.wordmark} — ${messages.archive.title} de ${month}`,
  dailyTitle: (name: string) => `${name} de hoje — ${messages.brand.wordmark}`,
  dailyDescription: (name: string) =>
    `O ${name} de hoje no ${messages.brand.wordmark}: um por dia, igual para todo mundo.`,
};
