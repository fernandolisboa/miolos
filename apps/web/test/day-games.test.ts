import { GAMES } from "@miolos/core";
import { describe, expect, it } from "vitest";

import {
  archiveGameRoute,
  messages,
  playRoutes,
  routeSlugs,
} from "../src/i18n";
import { ACCENT_SHADOW, ACCENT_TAPE } from "../src/og/tokens";
import { accentVars } from "../src/play/accent";
import { DAY_GAMES } from "../src/play/day-games";
import { colorTokens } from "./css-source";

describe("DAY_GAMES is the hub's one ordering, a permutation of @miolos/core's GAMES (T-WEB-S417)", () => {
  it("carries exactly the same games as GAMES, in some order", () => {
    expect([...DAY_GAMES].sort()).toEqual([...GAMES].sort());
  });

  it("puts the Cruzadinha second, beside Termo, and Rainhas last", () => {
    expect(DAY_GAMES).toEqual([
      "termo",
      "crossword",
      "sudoku",
      "nonogram",
      "binairo",
      "queens",
    ]);
  });
});

describe("Rainhas joins every list of games (T-WEB-S448)", () => {
  it("has its route, its day-card name and the game copy's lists", () => {
    expect(routeSlugs.queens).toBe("rainhas");
    expect(playRoutes.queens).toBe("/rainhas");
    expect(archiveGameRoute("2026-10-12", "queens")).toBe(
      "/arquivo/2026-10-12/rainhas",
    );
    expect(messages.conclusion.dayCard.games.queens).toBe("Rainhas");
    for (const game of DAY_GAMES) {
      const name = messages.games[game].name;
      expect(messages.meta.description, game).toContain(name);
      expect(messages.onboarding.lead, game).toContain(name);
    }
  });

  it("paints its own accent, with the OG deck on the same hex as tokens.css", () => {
    expect(accentVars("queens")).toEqual({
      "--accent": "var(--accent-queens)",
      "--ink-on-accent": "var(--paper-desk)",
    });
    const light = colorTokens("light").get("--accent-queens");
    expect(ACCENT_SHADOW.queens.slice(0, 7)).toBe(light);
    expect(ACCENT_TAPE.queens.slice(0, 7)).toBe(light);
  });
});
