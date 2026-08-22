import { messages } from "../i18n";

/**
 * Open Graph copy (#34, ADR-0054 decisions 7 and 10). Two kinds.
 *
 * HOMED HERE RATHER THAN IN `src/i18n/messages.ts`, and that is a bundle
 * decision, not a filing one (step-6 finding F5). It is `src/medals/copy.ts`'s
 * recorded precedent applied to a second deck: bundlers do not eliminate
 * unused PROPERTIES of an object literal, only unused exports, so as a member
 * of `messages` this ~300-350 bytes of server-only prose rode into the client
 * chunk of every route that imports `messages` for anything at all — which is
 * every route. Nothing here is ever rendered in the browser: the `alt` strings
 * are metadata-route module exports, the `daily*` pairs are `generateMetadata`
 * values, and `siteTagline` is drawn into a PNG by satori.
 *
 * Two rules keep it that way, both of them the medals module's:
 *   - **the i18n barrel must never re-export this**, and
 *   - `messages.ts` must never import it.
 * Either edge puts the prose back on every route. The direction taken HERE —
 * this module reading `messages.brand.wordmark` — is the safe one: it adds og
 * copy to the graph of the og surface, which already holds it.
 *
 * `altGame` is the image route's static `alt` export, and it is DATELESS by
 * constraint rather than by choice: `alt` is a module export on a metadata
 * route and cannot read `params`, so there is no date to put in it. Written
 * down here so a reviewer does not read the omission as an oversight.
 * `altSite` has a second home — `app/opengraph-image.alt.txt`, the file
 * convention's own carrier for a STATIC card — and `T-WEB-S204` holds the two
 * byte-equal so the deck stays the single source.
 *
 * The four `daily*` pairs are the ONLY metadata the daily play routes carry.
 * They are deliberately not page `title`/`description`: those stay inherited
 * from the root layout, which is what keeps ADR-0028 `:37-39`'s "the daily
 * routes are not an SEO surface" literally true (ADR-0054 decision 10). The
 * archive PLAY routes add no copy at all — they reuse the
 * `messages.archive.meta` strings they already compose. The three archive
 * SHELL cards do add copy (#104, ADR-0071): a tagline for the index card,
 * which has no date to print, and three `alt` strings. Two of those three are
 * DATED, which is the mirror image of `altGame`'s constraint above rather
 * than an exception to it: the day and month cards are referenced by an
 * explicit `openGraph.images` entry composed inside `generateMetadata`, which
 * CAN read `params`, so the reason `altGame` is dateless does not reach them.
 *
 * None of these strings contains `então`, `mamãe` or `época`
 * (`route-client-js.mjs`'s `const FORBIDDEN_EVERYWHERE` — by symbol, because
 * the line has rotted twice), and `T-WEB-S206a`
 * keeps it audited — the `messages.share` half is `T-WEB-S206`.
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
   * `messages.ts:23-25` polices in its own words ("a second copy is how two
   * screens drift apart"), and the two would sit on the same surface. It is
   * written out here rather than sliced off `lead` at runtime, because a copy
   * deck holding string surgery is worse than a copy deck holding a string —
   * the same call `siteTagline` above records. `T-WEB-S206a` asserts this is
   * a PREFIX of `messages.archive.lead`, so the two cannot drift apart
   * silently.
   *
   * `messages.archive.meta.indexDescription` was the alternative and is 90
   * characters — a wall of body copy where the composition wants a tagline,
   * the identical argument `siteTagline` makes against `meta.description`.
   */
  archiveTagline: "Todos os puzzles do dia desde o começo.",
  /**
   * The ARCHIVE DAY card's caption line — the year the display line dropped,
   * and the section it belongs to.
   *
   * It exists because of a MEASUREMENT and not a preference (plan 068 §12.2,
   * rung 2): the full `formatLongDate` output at the card's 96px Fraunces
   * runs to 1111px against 890px of card, so the year moves down a line
   * rather than off the card. `formatDayAndMonth` is the other half.
   *
   * The interpunct is the repo's own separator for two facts about one date
   * (`formatDayInMonth`'s "31 · segunda-feira" before #163 retired it), and
   * "Arquivo" comes from `messages`, never re-typed.
   */
  archiveDayCaption: (year: string) => `de ${year} · ${messages.archive.title}`,
  /**
   * The three archive cards' `alt` strings.
   *
   * `altArchiveIndex` has a second home — `app/arquivo/opengraph-image.alt.txt`,
   * the file convention's own carrier for a STATIC card — and `T-WEB-S204`
   * holds the two byte-equal, exactly as it does for `altSite`.
   *
   * The other two are DATED, which `altGame` cannot be: they are carried by
   * an `images[].alt` composed inside `generateMetadata`, which reads
   * `params`, rather than by a metadata route's static module export.
   *
   * "Arquivo" and the wordmark are composed from `messages`, never re-typed —
   * `messages.archive.title` is capitalised mid-sentence everywhere the
   * product already writes it (`backToIndexAria`, `meta.monthTitle`), and
   * `altArchiveMonth` matches `meta.monthTitle`'s register exactly.
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
