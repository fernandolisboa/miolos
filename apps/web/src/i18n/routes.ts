import type { Game } from "@miolos/core";

import type { FreePlayGame } from "../free-play/catalog";

export const routeSlugs = {
  archive: "arquivo",
  month: "mes",
  card: "cartao",
  freePlay: "modo-livre",
  stats: "estatisticas",
  attach: "vincular",
  privacy: "privacidade",
  terms: "termos",
  binairo: "binairo",
  sudoku: "sudoku",
  nonogram: "nonogram",
  termo: "termo",
  conclusion: "concluido",
} as const;

export type RouteSlug = keyof typeof routeSlugs;

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
  stats: `/${routeSlugs.stats}`,
  attach: `/${routeSlugs.attach}`,
  privacy: `/${routeSlugs.privacy}`,
  terms: `/${routeSlugs.terms}`,
  archive: `/${routeSlugs.archive}`,
} as const;

export type Route = (typeof routes)[keyof typeof routes];

export function archiveMonthRoute(month: string): string {
  return `${routes.archive}/${routeSlugs.month}/${month}`;
}

export function archiveDayRoute(date: string): string {
  return `${routes.archive}/${date}`;
}

export function archiveGameRoute(date: string, game: Game): string {
  return `${archiveDayRoute(date)}/${routeSlugs[game]}`;
}

export function archiveDayCardRoute(date: string): string {
  return `/${routeSlugs.card}/${date}`;
}

export function archiveMonthCardRoute(month: string): string {
  return `/${routeSlugs.card}/${routeSlugs.month}/${month}`;
}

export const playRoutes: Readonly<Record<Game, Route>> = {
  binairo: routes.binairo,
  nonogram: routes.nonogram,
  sudoku: routes.sudoku,
  termo: routes.termo,
};

export const freePlayRoutes: Readonly<Record<FreePlayGame, Route>> = {
  binairo: routes.freePlayBinairo,
  sudoku: routes.freePlaySudoku,
  nonogram: routes.freePlayNonogram,
};
