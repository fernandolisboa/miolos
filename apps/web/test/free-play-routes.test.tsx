import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HojePage from "../app/page";
import FreePlayIndexPage from "../app/modo-livre/page";
import { FREE_PLAY_GAMES } from "../src/free-play/catalog";
import { freePlayRoutes, messages, routes, routeSlugs } from "../src/i18n";

describe("the free-play route literals (T-WEB-S111)", () => {
  it("composes every freePlay* entry from routeSlugs, never a literal", () => {
    expect(routes.freePlay).toBe(`/${routeSlugs.freePlay}`);
    expect(routes.freePlayBinairo).toBe(
      `/${routeSlugs.freePlay}/${routeSlugs.binairo}`,
    );
    expect(routes.freePlaySudoku).toBe(
      `/${routeSlugs.freePlay}/${routeSlugs.sudoku}`,
    );
    expect(routes.freePlayNonogram).toBe(
      `/${routeSlugs.freePlay}/${routeSlugs.nonogram}`,
    );
    expect(routes.freePlayTermo).toBe(
      `/${routeSlugs.freePlay}/${routeSlugs.termo}`,
    );
    expect(routes.freePlayCrossword).toBe(
      `/${routeSlugs.freePlay}/${routeSlugs.crossword}`,
    );
    expect(routes.freePlayQueens).toBe(
      `/${routeSlugs.freePlay}/${routeSlugs.queens}`,
    );
  });

  it("freePlayRoutes covers exactly the six free-play games", () => {
    expect(Object.keys(freePlayRoutes).sort()).toEqual(
      [...FREE_PLAY_GAMES].sort(),
    );
    for (const game of FREE_PLAY_GAMES) {
      expect(freePlayRoutes[game]).toBe(
        `/${routeSlugs.freePlay}/${routeSlugs[game]}`,
      );
    }
  });
});

describe("the app/modo-livre segment (T-WEB-S112)", () => {
  it("holds exactly the index and the six game segments", () => {
    const segment = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "app",
      "modo-livre",
    );

    expect(readdirSync(segment).sort()).toEqual([
      "binairo",
      "cruzadinha",
      "nonogram",
      "page.module.css",
      "page.tsx",
      "rainhas",
      "sudoku",
      "termo",
    ]);
  });
});

describe("the Modo livre index (T-WEB-S113)", () => {
  it("renders six card links and its marker; the Termo card does not promise the word of the day", () => {
    const { container } = render(<FreePlayIndexPage />);

    const main = container.querySelector("main");
    expect(main).toHaveAttribute("data-free-play", "index");

    for (const game of FREE_PLAY_GAMES) {
      const title = screen.getByText(messages.games[game].name);
      const card = title.closest("a");
      expect(card).toHaveAttribute("href", freePlayRoutes[game]);
    }

    const anchors = [...container.querySelectorAll("a[href]")];
    const cardAnchors = anchors.filter((anchor) =>
      anchor.getAttribute("href")?.startsWith(routes.freePlay),
    );
    expect(cardAnchors).toHaveLength(6);

    expect(
      screen.getByText(String(messages.freePlay.descriptions.termo)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.games.termo.description),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.freePlay.title,
    );
    expect(screen.getByText(messages.freePlay.lead)).toBeInTheDocument();
  });
});

describe("the hub's Modo livre entry (T-WEB-S114)", () => {
  it("links Modo livre to routes.freePlay and Arquivo to routes.archive", () => {
    render(<HojePage />);
    const nav = screen.getByRole("navigation", {
      name: messages.hoje.links.aria,
    });

    const freePlay = within(nav).getByText(messages.hoje.links.freePlay);
    expect(freePlay.closest("a")).toHaveAttribute("href", routes.freePlay);

    const archive = within(nav).getByText(messages.hoje.links.archive);
    expect(archive.closest("a")).toHaveAttribute("href", routes.archive);
  });
});
