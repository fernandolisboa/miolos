/**
 * Route slugs live with the i18n strings (ADR-0013): English identifiers,
 * pt-BR slugs. Game names are proper product nouns and stay untranslated
 * (CONTEXT.md); only the descriptive segments are pt-BR (ADR-0028).
 */
export const routeSlugs = {
  archive: "arquivo",
  freePlay: "modo-livre",
  stats: "estatisticas",
  binairo: "binairo",
  conclusion: "concluido",
} as const;

export type RouteSlug = keyof typeof routeSlugs;

/**
 * Composed paths (ADR-0028). `as const` keeps these literal types, which
 * Next 16's typed routes require of a `<Link href>` — a function
 * returning `string` would not typecheck.
 *
 * EXTENSION POINT: #23/#25/#27 add `/<jogo>` and `/<jogo>/concluido` here,
 * never as literals at a call site.
 */
export const routes = {
  home: "/",
  binairo: `/${routeSlugs.binairo}`,
  binairoConclusion: `/${routeSlugs.binairo}/${routeSlugs.conclusion}`,
} as const;
