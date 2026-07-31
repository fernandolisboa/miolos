/**
 * Route slugs live with the i18n strings (ADR-0013): English identifiers,
 * pt-BR slugs. The routes themselves arrive with later tickets.
 */
export const routeSlugs = {
  archive: "arquivo",
  freePlay: "modo-livre",
  stats: "estatisticas",
} as const;

export type RouteSlug = keyof typeof routeSlugs;
