import { ORIGINAL_GAMES, type MedalRule } from "@miolos/core";

import { ACCENTS } from "../play/accent";

const APP = "var(--accent-app)";
const PAPER = "var(--paper-card)";
const INK = "var(--ink)";

export type MedalMark =
  | { readonly kind: "numeral"; readonly text: string }
  | { readonly kind: "games"; readonly colors: readonly string[] }
  | { readonly kind: "star" };

export interface MedalArt {
  readonly ribbon: string;
  readonly stripes: readonly string[];
  readonly mark: MedalMark;
}

const ORIGINAL_ACCENTS = ORIGINAL_GAMES.map((game) => ACCENTS[game]);

function numeral(value: number | string): MedalMark {
  return { kind: "numeral", text: String(value) };
}

export function artOf(rule: MedalRule): MedalArt {
  switch (rule.kind) {
    case "totalWins":
      return {
        ribbon: rule.game === null ? APP : ACCENTS[rule.game],
        stripes: [],
        mark: numeral(rule.count),
      };
    case "streakReached":
      return { ribbon: APP, stripes: [PAPER], mark: numeral(rule.days) };
    case "perfectDaysReached":
      return {
        ribbon: APP,
        stripes: [PAPER, PAPER],
        mark: numeral(rule.count),
      };
    case "termoGuessWins":
      return {
        ribbon: ACCENTS.termo,
        stripes: [PAPER],
        mark: numeral(`${String(rule.guesses)}ª`),
      };
    case "eachGameWon":
      return {
        ribbon: APP,
        stripes: ORIGINAL_ACCENTS,
        mark: { kind: "games", colors: ORIGINAL_ACCENTS },
      };
    case "curated":
      return { ribbon: APP, stripes: [INK], mark: { kind: "star" } };
  }
}
