/**
 * The free-play routes and entry points (#28, ADR-0046, plan 025 §9.3):
 * the typed route literals, the index screen, and the hub's link. The
 * Termo-absence assertions live here beside the things they constrain.
 */
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
  });

  it("freePlayRoutes covers exactly the three grid games", () => {
    expect(Object.keys(freePlayRoutes).sort()).toEqual(
      [...FREE_PLAY_GAMES].sort(),
    );
    expect(Object.keys(freePlayRoutes)).not.toContain("termo");
    for (const game of FREE_PLAY_GAMES) {
      expect(freePlayRoutes[game]).toBe(`/${routeSlugs.freePlay}/${game}`);
    }
  });
});

describe("the Modo livre index (T-WEB-S113)", () => {
  it("renders three card links, its marker, and no occurrence of Termo", () => {
    const { container } = render(<FreePlayIndexPage />);

    const main = container.querySelector("main");
    expect(main).toHaveAttribute("data-free-play", "index");

    // The three cards, each a REAL link to its free-play route.
    for (const game of FREE_PLAY_GAMES) {
      const title = screen.getByText(messages.games[game].name);
      const card = title.closest("a");
      expect(card).toHaveAttribute("href", freePlayRoutes[game]);
    }

    // Exactly three card links — the back link is the only other anchor.
    const anchors = [...container.querySelectorAll("a[href]")];
    const cardAnchors = anchors.filter((anchor) =>
      anchor.getAttribute("href")?.startsWith(routes.freePlay),
    );
    expect(cardAnchors).toHaveLength(3);

    expect(container.textContent).not.toContain("Termo");

    // The contract line and the title, through the messages module.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.freePlay.title,
    );
    expect(screen.getByText(messages.freePlay.lead)).toBeInTheDocument();
  });
});

describe("the hub's Modo livre entry (T-WEB-S114)", () => {
  it("links Modo livre to routes.freePlay; Arquivo and Estatísticas stay href-less", () => {
    render(<HojePage />);
    const nav = screen.getByRole("navigation");

    const freePlay = within(nav).getByText(messages.hoje.links.freePlay);
    expect(freePlay.closest("a")).toHaveAttribute("href", routes.freePlay);

    const archive = within(nav).getByText(messages.hoje.links.archive);
    expect(archive.closest("a")).not.toHaveAttribute("href");

    const stats = within(nav).getByText(messages.hoje.links.stats);
    expect(stats.closest("a")).not.toHaveAttribute("href");
  });
});
