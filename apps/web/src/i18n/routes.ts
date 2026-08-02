/**
 * Route slugs live with the i18n strings (ADR-0013): English identifiers,
 * pt-BR slugs. Game names are proper product nouns and stay untranslated
 * (CONTEXT.md); only the descriptive segments are pt-BR (ADR-0028).
 */
import type { Game } from "@miolos/core";

export const routeSlugs = {
  archive: "arquivo",
  freePlay: "modo-livre",
  stats: "estatisticas",
  binairo: "binairo",
  sudoku: "sudoku",
  // An untranslated proper noun, which is what makes `/nonogram` a legal
  // pt-BR route under ADR-0028 — only the descriptive segments are pt-BR.
  nonogram: "nonogram",
  conclusion: "concluido",
} as const;

export type RouteSlug = keyof typeof routeSlugs;

/**
 * Composed paths (ADR-0028). `as const` keeps these literal types, which
 * Next 16's typed routes require of a `<Link href>` — a function
 * returning `string` would not typecheck.
 *
 * EXTENSION POINT: #27 adds `/<jogo>` and `/<jogo>/concluido` here, never as
 * literals at a call site. #23 added sudoku's pair, #25 nonogram's.
 */
export const routes = {
  home: "/",
  binairo: `/${routeSlugs.binairo}`,
  binairoConclusion: `/${routeSlugs.binairo}/${routeSlugs.conclusion}`,
  sudoku: `/${routeSlugs.sudoku}`,
  sudokuConclusion: `/${routeSlugs.sudoku}/${routeSlugs.conclusion}`,
  nonogram: `/${routeSlugs.nonogram}`,
  nonogramConclusion: `/${routeSlugs.nonogram}/${routeSlugs.conclusion}`,
} as const;

export type Route = (typeof routes)[keyof typeof routes];

/**
 * Where each game's play screen lives — ONE map, read by the hub's tiles
 * (plan 018 §11.3) and by the conclusion's chaining CTA (§11.4). Two copies
 * of it is how the hub links a game the conclusion still calls pending.
 *
 * Partial by construction: #25/#27 add a key here, never a branch at a call
 * site (ADR-0028). A game with no key has no play route yet, and its card
 * keeps an href-less anchor rather than fake navigation.
 */
export const playRoutes: Readonly<Partial<Record<Game, Route>>> = {
  binairo: routes.binairo,
  nonogram: routes.nonogram,
  sudoku: routes.sudoku,
};
