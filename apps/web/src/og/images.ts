import { CARD_HEIGHT, CARD_WIDTH } from "./card";

/**
 * One `openGraph.images` entry, for the two archive shells that reference
 * their card by URL instead of by the file convention (#104, ADR-0071).
 *
 * **Its whole purpose is that no string literal enters a `generateMetadata`
 * body.** `archive-metadata.test.ts:135` (`T-WEB-S173`) slices each of the
 * three shells' `generateMetadata` from its opening to the first `\n}\n` and
 * asserts the block contains NO quoted literal of two characters or more.
 * `"image/png"` is such a literal and `/cartao/…` would be another, so both
 * live here and in `i18n/routes.ts` respectively. If that scan ever reds, the
 * fix is to move a literal into a module — never to weaken the scan.
 *
 * The dimensions are read off `./card` rather than re-typed, so a card that
 * ever changed size could not advertise the old numbers. That import is also
 * the reason this module can sit in a PAGE's graph at no trace cost:
 * `card.tsx` imports no `next/og`, and a production build measured the day
 * page unchanged at 2.7 MB / 115 traced files with it in place.
 *
 * `alt` is a parameter and not a constant, because these two cards' `alt`
 * strings are DATED — the mirror image of `ogCopy.altGame`'s constraint. A
 * metadata route's `alt` is a module export and cannot read `params`; an
 * `images[].alt` composed inside `generateMetadata` can.
 */
export function cardImage(url: string, alt: string) {
  return {
    url,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alt,
    type: "image/png",
  };
}
