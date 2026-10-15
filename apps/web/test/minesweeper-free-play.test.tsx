import { GAMES } from "@miolos/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FreePlayIndexPage from "../app/modo-livre/page";
import { FREE_PLAY_GAMES } from "../src/free-play/catalog";
import {
  freePlayRoutes,
  messages,
  playRoutes,
  routes,
  routeSlugs,
} from "../src/i18n";
import { ACCENTS, accentVars } from "../src/play/accent";
import { GameSettings } from "../src/settings/game-settings";
import { readSettings } from "../src/settings/settings";
import { bodyOf, decl, stylesheet } from "./css-source";

describe("Campo Minado is free play only: the daily games do not grow (T-WEB-S880)", () => {
  it("leaves the daily game list, routes and hint copy as they were", () => {
    expect(GAMES).not.toContain("minesweeper");
    expect(Object.keys(playRoutes).sort()).toEqual([...GAMES].sort());
    expect(Object.keys(messages.freePlay.descriptions)).toEqual(["termo"]);
  });

  it("gives it a slug, a route, an accent and a hub card", () => {
    expect(routeSlugs.minesweeper).toBe("campo-minado");
    expect(routes.freePlayMinesweeper).toBe("/modo-livre/campo-minado");
    expect(freePlayRoutes.minesweeper).toBe(routes.freePlayMinesweeper);
    expect(ACCENTS.minesweeper).toBe("var(--accent-minesweeper)");
    expect(accentVars("minesweeper")["--accent"]).toBe(
      "var(--accent-minesweeper)",
    );
    expect(messages.freePlay.solved.again.minesweeper).toBe("Mais um");
  });

  it("lists it last in the hub, linked to its screen", () => {
    expect(FREE_PLAY_GAMES.at(-1)).toBe("minesweeper");
    render(<FreePlayIndexPage />);
    const card = screen.getByText(messages.games.minesweeper.name).closest("a");
    expect(card).toHaveAttribute("href", "/modo-livre/campo-minado");
    expect(
      screen.getByText(messages.games.minesweeper.description),
    ).toBeInTheDocument();
  });

  it("centres the seventh card alone on its row, rotated like its siblings", () => {
    const hub = stylesheet("app/modo-livre/page.module.css");
    expect(decl(bodyOf(hub, ".card:nth-child(7)"), "grid-column")).toBe(
      "3 / span 2",
    );
    expect(decl(bodyOf(hub, ".card:nth-child(7)"), "transform")).toMatch(
      /^rotate\(-?\d+(\.\d+)?deg\)$/,
    );
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
