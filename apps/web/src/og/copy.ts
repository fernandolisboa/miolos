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
 * ARCHIVE routes add no copy at all — they reuse the `messages.archive.meta`
 * strings they already compose.
 *
 * None of these strings contains `então`, `mamãe` or `época`
 * (`FORBIDDEN_EVERYWHERE`, `route-client-js.mjs:285`), and `T-WEB-S206a`
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
  dailyTitle: (name: string) => `${name} de hoje — ${messages.brand.wordmark}`,
  dailyDescription: (name: string) =>
    `O ${name} de hoje no ${messages.brand.wordmark}: um por dia, igual para todo mundo.`,
};
