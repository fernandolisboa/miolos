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
  // Likewise an untranslated proper noun: "Termo" is the product's own name
  // for its Termo-like game (CONTEXT.md — and never "Wordle"), so the slug is
  // the noun and `concluido` is the only pt-BR segment on the pair.
  termo: "termo",
  conclusion: "concluido",
} as const;

export type RouteSlug = keyof typeof routeSlugs;

/**
 * Composed paths (ADR-0028). `as const` keeps these literal types, which
 * Next 16's typed routes require of a `<Link href>` — a function
 * returning `string` would not typecheck.
 *
 * #23 added sudoku's pair, #25 nonogram's and #27 termo's — always here, never
 * as a literal at a call site. All four dailies are routed; a fifth game adds
 * its pair the same way.
 */
export const routes = {
  home: "/",
  binairo: `/${routeSlugs.binairo}`,
  binairoConclusion: `/${routeSlugs.binairo}/${routeSlugs.conclusion}`,
  sudoku: `/${routeSlugs.sudoku}`,
  sudokuConclusion: `/${routeSlugs.sudoku}/${routeSlugs.conclusion}`,
  nonogram: `/${routeSlugs.nonogram}`,
  nonogramConclusion: `/${routeSlugs.nonogram}/${routeSlugs.conclusion}`,
  termo: `/${routeSlugs.termo}`,
  termoConclusion: `/${routeSlugs.termo}/${routeSlugs.conclusion}`,
} as const;

export type Route = (typeof routes)[keyof typeof routes];

/**
 * Where each game's play screen lives — ONE map, read by the hub's tiles
 * (plan 018 §11.3) and by the conclusion's chaining CTA (§11.4). Two copies
 * of it is how the hub links a game the conclusion still calls pending.
 *
 * Total since #75: #23 added sudoku's key here, #25 nonogram's and #27
 * termo's — always a key, never a branch at a call site (ADR-0028) — and
 * with all four games routed the `Partial` had become wider than the value,
 * forcing dead `route === undefined` branches on every consumer. A fifth
 * game now ADDS ITS KEY OR DOES NOT COMPILE, which is the stronger form of
 * the old "no key, no link" contract.
 */
export const playRoutes: Readonly<Record<Game, Route>> = {
  binairo: routes.binairo,
  nonogram: routes.nonogram,
  sudoku: routes.sudoku,
  termo: routes.termo,
};
