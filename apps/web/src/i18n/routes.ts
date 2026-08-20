/**
 * Route slugs live with the i18n strings (ADR-0013): English identifiers,
 * pt-BR slugs. Game names are proper product nouns and stay untranslated
 * (CONTEXT.md); only the descriptive segments are pt-BR (ADR-0028).
 */
import type { Game } from "@miolos/core";

import type { FreePlayGame } from "../free-play/catalog";

export const routeSlugs = {
  archive: "arquivo",
  // #31 (ADR-0053 decision 1): a LITERAL segment between `/arquivo` and the
  // month, so `app/arquivo/mes/[mes]` and `app/arquivo/[data]` can coexist.
  // Two dynamic segment NAMES at the same position is a Next build error;
  // Next resolves a static segment ahead of a dynamic sibling, and
  // `/arquivo/mes` with nothing after it matches `[data]` with `data = "mes"`,
  // which `calendarDateString` rejects -> 404.
  month: "mes",
  freePlay: "modo-livre",
  stats: "estatisticas",
  // #21 (ADR-0013, ADR-0050): the magic-link landing page and the privacy
  // policy — pt-BR slugs, matching CONTEXT.md's "Vincular e-mail".
  attach: "vincular",
  privacy: "privacidade",
  // #158: the terms of use — a pt-BR descriptive segment like `privacidade`
  // (ADR-0028). Plural on purpose: `/termos` (the legal page) and `/termo`
  // (the game, a proper noun) are distinct literal segments.
  terms: "termos",
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
 * Composed paths (ADR-0028). `as const` keeps these literal types because a
 * single-home path table wants literal types for its own callers.
 *
 * **Route typing is NOT enabled in this repo**, and the comment that used to
 * stand here — *"which Next 16's typed routes require of a `<Link href>` — a
 * function returning `string` would not typecheck"* — was false of this
 * configuration and is corrected at #31: `apps/web/next.config.ts` sets no
 * `typedRoutes` option, `.next/types/routes.d.ts` carries no `declare module
 * "next/link"` augmentation, and `next/link`'s own `href` is `string |
 * UrlObject`. Enabling `typedRoutes` is a separate decision, explicitly out
 * of #31's scope, and it would need the three archive builders below reworked
 * (the generated `Routes` union is a finite literal union that a
 * template-literal builder cannot satisfy).
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
  freePlay: `/${routeSlugs.freePlay}`,
  freePlayBinairo: `/${routeSlugs.freePlay}/${routeSlugs.binairo}`,
  freePlaySudoku: `/${routeSlugs.freePlay}/${routeSlugs.sudoku}`,
  freePlayNonogram: `/${routeSlugs.freePlay}/${routeSlugs.nonogram}`,
  // #29 (ADR-0051): the statistics screen — index only, no per-game
  // sub-paths (one screen, sectioned; plan 033 D11).
  stats: `/${routeSlugs.stats}`,
  attach: `/${routeSlugs.attach}`,
  privacy: `/${routeSlugs.privacy}`,
  terms: `/${routeSlugs.terms}`,
  // #31 (ADR-0053 decision 1): the archive index. The three date-bearing
  // paths below it are builders rather than keys, because a date is not a
  // literal — but they still live HERE, so `/arquivo` has exactly one home
  // in the app (T-WEB-S166 makes that a source scan).
  archive: `/${routeSlugs.archive}`,
} as const;

export type Route = (typeof routes)[keyof typeof routes];

/**
 * The archive's three date-bearing paths (#31, ADR-0053 decision 1). Plain
 * composed strings: they are the same single-home rule the table above
 * carries, applied to paths whose last segment is data.
 *
 * They return `string` and not a literal type, which is fine because route
 * typing is not enabled here (see the note on `routes` above) — and which is
 * exactly what would have to change if it ever were.
 */
export function archiveMonthRoute(month: string): string {
  return `${routes.archive}/${routeSlugs.month}/${month}`;
}

export function archiveDayRoute(date: string): string {
  return `${routes.archive}/${date}`;
}

export function archiveGameRoute(date: string, game: Game): string {
  return `${archiveDayRoute(date)}/${routeSlugs[game]}`;
}

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

/**
 * Where each free-play game lives. Total over `FreePlayGame` BY TYPE:
 * adding termo here is a compile error, not a review catch (ADR-0046).
 * The asymmetry with `playRoutes` above is deliberate — the daily map is
 * keyed by `Game` (all four), this one by `FreePlayGame` (three), so the
 * type system itself carries the Termo exclusion (ADR-0005, plan 025 §9.3).
 */
export const freePlayRoutes: Readonly<Record<FreePlayGame, Route>> = {
  binairo: routes.freePlayBinairo,
  sudoku: routes.freePlaySudoku,
  nonogram: routes.freePlayNonogram,
};
