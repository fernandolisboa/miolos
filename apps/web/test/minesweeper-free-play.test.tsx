import { GAMES } from "@miolos/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FreePlayIndexPage from "../app/modo-livre/page";
import {
  freePlayRoutes,
  messages,
  playRoutes,
  routes,
  routeSlugs,
} from "../src/i18n";
import { ACCENTS, accentVars } from "../src/play/accent";
import { DAY_GAMES } from "../src/play/day-games";
import { GameSettings } from "../src/settings/game-settings";
import { readSettings } from "../src/settings/settings";
import { bodyOf, decl, stylesheet } from "./css-source";

describe("Campo Minado sits in both catalogues, the daily and free play (T-WEB-S928)", () => {
  it("is the last of GAMES and of the hub's lineup, with a daily route", () => {
    expect(GAMES.at(-1)).toBe("minesweeper");
    expect(DAY_GAMES.at(-1)).toBe("minesweeper");
    expect(playRoutes.minesweeper).toBe("/campo-minado");
    expect(routes.minesweeperConclusion).toBe("/campo-minado/concluido");
    expect(Object.keys(playRoutes).sort()).toEqual([...GAMES].sort());
    expect(Object.keys(freePlayRoutes).sort()).toEqual([...GAMES].sort());
  });

  it("gives it a slug, a free-play route, an accent and its own free-play blurb", () => {
    expect(routeSlugs.minesweeper).toBe("campo-minado");
    expect(routes.freePlayMinesweeper).toBe("/modo-livre/campo-minado");
    expect(freePlayRoutes.minesweeper).toBe(routes.freePlayMinesweeper);
    expect(ACCENTS.minesweeper).toBe("var(--accent-minesweeper)");
    expect(accentVars("minesweeper")["--accent"]).toBe(
      "var(--accent-minesweeper)",
    );
    expect(messages.freePlay.solved.again.minesweeper).toBe("Mais um");
    expect(Object.keys(messages.freePlay.descriptions).sort()).toEqual([
      "minesweeper",
      "termo",
    ]);
    expect(messages.freePlay.descriptions.minesweeper).not.toBe(
      messages.games.minesweeper.description,
    );
  });

  it("lists it last in the free-play hub with the free-play blurb, linked to its screen", () => {
    render(<FreePlayIndexPage />);
    const card = screen.getByText(messages.games.minesweeper.name).closest("a");
    expect(card).toHaveAttribute("href", "/modo-livre/campo-minado");
    expect(
      screen.getByText(String(messages.freePlay.descriptions.minesweeper)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.games.minesweeper.description),
    ).toBeNull();
  });

  it("centres a last card that would sit alone on its row, whatever the roster", () => {
    const hub = stylesheet("app/modo-livre/page.module.css");
    expect(
      decl(bodyOf(hub, ".card:last-child:nth-child(3n + 1)"), "grid-column"),
    ).toBe("3 / span 2");
    expect(hub).not.toMatch(/\.card:nth-child\(7\)\s*\{[^}]*grid-column/);
  });
});

describe("Marcas (?) is a device setting, off by default, in Ajustes and in the game's dialog (T-WEB-S882)", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads a blob saved before the game existed, keeping every other choice", () => {
    window.localStorage.setItem(
      "miolos-settings",
      JSON.stringify({
        showClock: false,
        games: { sudoku: { showErrors: true } },
      }),
    );
    const settings = readSettings();

    expect(settings.games.minesweeper).toEqual({ questionMarks: false });
    expect(settings.showClock).toBe(false);
    expect(settings.games.sudoku.showErrors).toBe(true);
  });

  it("falls back to off on a junk value", () => {
    window.localStorage.setItem(
      "miolos-settings",
      JSON.stringify({ games: { minesweeper: { questionMarks: "sim" } } }),
    );
    expect(readSettings().games.minesweeper.questionMarks).toBe(false);
  });

  it("offers the switch under Campo Minado and writes it through", () => {
    render(<GameSettings games={["minesweeper"]} clock />);
    const label = messages.settings.games.flags.questionMarks.label;

    expect(
      screen.getByText(messages.games.minesweeper.name),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: label }));

    expect(readSettings().games.minesweeper.questionMarks).toBe(true);
  });
});
