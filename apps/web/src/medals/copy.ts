import type { MedalId } from "@miolos/core";

/**
 * The 23 medal name/description records (#30, ADR-0052) — still the
 * ADR-0018 contract (typed, in-repo, composed), homed HERE rather than in
 * `src/i18n/messages.ts` by plan 035 §14 watch item 2's recorded
 * fallback, applied after measurement: as a second export of the messages
 * module, Turbopack kept the ~2 KB of prose in the shared chunk of every
 * route that imports `messages` for anything else (the unused-export
 * elimination the tree-shake argument assumed did not happen). In its own
 * module, only the medal section's graph carries it — the bundle figures
 * in the PR are the evidence. This module must import NOTHING from
 * `messages`, and the i18n barrel must never re-export it: either edge
 * would put the prose back on every route.
 *
 * The copy is VERBATIM the catalog table in `content/medals/README.md`
 * (T-WEB-S163 pins the parity both directions), authored against that
 * file's written constraints: past-tense statements of the achieved fact,
 * first word from the recorded allowlist, thresholds as digits, no
 * imperatives, no vetoed vocabulary, the stationery register where it
 * fits. `satisfies Record<MedalId, …>` makes exhaustiveness a typecheck
 * in both directions — a missing id and a stray id are both compile
 * errors.
 *
 * BEHIND THE FREE-PLAY WALL like its siblings: the whole src/medals
 * directory is banned by name from apps/web/src/free-play and
 * app/modo-livre (eslint.config.mjs, ADR-0046).
 */
export const medalCopy = {
  "first-win": {
    name: "Primeiro carimbo",
    description: "Venceu um jogo diário pela primeira vez.",
  },
  "wins-10": {
    name: "Dez vitórias",
    description: "Venceu 10 jogos diários.",
  },
  "wins-50": {
    name: "Cinquenta vitórias",
    description: "Venceu 50 jogos diários.",
  },
  "wins-100": {
    name: "Cem vitórias",
    description: "Venceu 100 jogos diários.",
  },
  "wins-500": {
    name: "Meio milhar",
    description: "Venceu 500 jogos diários.",
  },
  "binairo-30": {
    name: "Trinta de Binairo",
    description: "Venceu o Binairo diário 30 vezes.",
  },
  "sudoku-30": {
    name: "Trinta de Sudoku",
    description: "Venceu o Sudoku diário 30 vezes.",
  },
  "nonogram-30": {
    name: "Trinta de Nonogram",
    description: "Venceu o Nonogram diário 30 vezes.",
  },
  "termo-30": {
    name: "Trinta de Termo",
    description: "Venceu o Termo diário 30 vezes.",
  },
  "streak-3": {
    name: "Três dias de tinta",
    description: "Chegou a uma sequência de 3 dias.",
  },
  "streak-7": {
    name: "Sequência de sete",
    description: "Chegou a uma sequência de 7 dias.",
  },
  "streak-30": {
    name: "Um mês inteiro",
    description: "Chegou a uma sequência de 30 dias.",
  },
  "streak-100": {
    name: "Centena corrida",
    description: "Chegou a uma sequência de 100 dias.",
  },
  "streak-365": {
    name: "Um ano de caderno",
    description: "Chegou a uma sequência de 365 dias.",
  },
  "perfect-1": {
    name: "Quatro de quatro",
    description: "Concluiu um Dia Perfeito: os quatro jogos no mesmo dia.",
  },
  "perfect-5": {
    name: "Mão firme",
    description: "Concluiu 5 Dias Perfeitos.",
  },
  "perfect-10": {
    name: "Caderno caprichado",
    description: "Concluiu 10 Dias Perfeitos.",
  },
  "perfect-30": {
    name: "Trinta sem borrão",
    description: "Concluiu 30 Dias Perfeitos.",
  },
  "termo-first-try": {
    name: "De primeira",
    description: "Acertou o Termo na primeira tentativa.",
  },
  "termo-in-two": {
    name: "Dez na segunda",
    description: "Acertou o Termo na segunda tentativa 10 vezes.",
  },
  "termo-last-guess": {
    name: "Por um fio",
    description: "Acertou o Termo na última tentativa.",
  },
  "all-games": {
    name: "Circuito completo",
    description: "Venceu cada um dos quatro jogos ao menos uma vez.",
  },
  founder: {
    name: "Da primeira leva",
    description: "Estava aqui quando tudo começou.",
  },
} as const satisfies Record<
  MedalId,
  { readonly name: string; readonly description: string }
>;
