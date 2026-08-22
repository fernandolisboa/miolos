import { CARD_HEIGHT, CARD_WIDTH } from "./card";

/**
 * One `openGraph.images` entry, for the two archive shells that reference
 * their card by URL instead of by the file convention (#104, ADR-0071).
 *
 * **The dimensions and the MIME type get ONE home.** Both are read off
 * `./card` or written once here rather than re-typed at each `generateMetadata`
 * call site, so a card that ever changed size could not advertise the old
 * numbers, and `"image/png"` cannot drift between two routes. That `./card`
 * import is also the reason this module can sit in a PAGE's graph at no trace
 * cost: `card.tsx` imports no `next/og`, and a production build measured the
 * day page unchanged at 2.7 MB / 115 traced files with it in place.
 *
 * A side effect of the same single home, worth knowing before someone inlines
 * this: `T-WEB-S173` (`archive-metadata.test.ts`, *"no metadata function
 * carries a string literal"*) strips each of the three shells' comments,
 * slices from `function generateMetadata` to the first `\n}\n`, and rejects
 * any quoted run of two characters or more inside it. `"image/png"` is such a
 * run and `/cartao/…` would be another, so both live here and in
 * `i18n/routes.ts` respectively. If that scan ever reds, the fix is to move a
 * literal into a module — never to weaken the scan.
 *
 * `alt` is a parameter and not a constant, because these two cards' `alt`
 * strings are DATED — the mirror image of `ogCopy.altGame`'s constraint. A
 * metadata route's `alt` is a module export and cannot read `params`; an
 * `images[].alt` composed inside `generateMetadata` can.
 *
 * **NAMED ARGUMENTS, not two positional strings.** `url` and `alt` are both
 * `string` and both computed at every call site, so a positional pair
 * typechecks when swapped and ships an `og:image` pointing at a pt-BR
 * sentence. Every sibling in this family already takes an object
 * (`gameCard`, `archiveCard`, `paper`), and the return type is declared for
 * the same reason: this value crosses into `Metadata`.
 */
export interface OgImageEntry {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly type: string;
}

export function cardImage(args: {
  readonly url: string;
  readonly alt: string;
}): OgImageEntry {
  return {
    url: args.url,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alt: args.alt,
    type: "image/png",
  };
}
