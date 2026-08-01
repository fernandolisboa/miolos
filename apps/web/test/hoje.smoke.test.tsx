import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HojePage from "../app/page";
import { messages, routes } from "../src/i18n";

// Smoke test for the Hoje screen (one per screen, spec seam 5). Every
// assertion goes through the messages module — never string literals —
// proving the copy is externalized.
describe("Hoje page", () => {
  it("renders the masthead, meta line and streak from the messages module", () => {
    render(<HojePage />);
    // One product name, one source of truth: `hoje.wordmark` is an alias of
    // `brand.wordmark`, which /binairo and the conclusion render too (§12.6).
    expect(screen.getByText(messages.brand.wordmark)).toBeInTheDocument();
    expect(screen.getByText(messages.hoje.wordmark)).toBeInTheDocument();
    expect(
      screen.getByText(messages.hoje.completedOfTotal(0, 4)),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.hoje.streak.label)).toBeInTheDocument();
    expect(
      screen.getByLabelText(messages.hoje.streak.aria(0)),
    ).toBeInTheDocument();
  });

  it("renders all four game cards pending, with copy from the messages module", () => {
    render(<HojePage />);
    for (const game of Object.values(messages.hoje.games)) {
      expect(screen.getByText(game.name)).toBeInTheDocument();
      expect(screen.getByText(game.kicker)).toBeInTheDocument();
      expect(screen.getByText(game.description)).toBeInTheDocument();
    }
    expect(screen.getAllByText(messages.hoje.playCta)).toHaveLength(4);
    expect(screen.getAllByText(messages.hoje.playCtaShort)).toHaveLength(4);
  });

  // T-WEB-21 (plan 017 §12.5): Binairo is the first daily with a real play
  // route. The other three CTAs stay href-less on purpose — a dead href
  // would be fake navigation.
  it("links only the Binairo card, and only to the binairo route", () => {
    render(<HojePage />);

    const ctas = screen
      .getAllByText(messages.hoje.playCta)
      .map((label) => label.closest("a"));

    expect(ctas).toHaveLength(4);
    const linked = ctas.filter((cta) => cta?.hasAttribute("href") === true);
    expect(linked).toHaveLength(1);
    expect(linked[0]).toHaveAttribute("href", routes.binairo);
    // The linked card is Binairo's, not one of the other three.
    expect(linked[0]?.closest("article")?.textContent).toContain(
      messages.hoje.games.binairo.name,
    );
  });

  it("renders the secondary links from the messages module", () => {
    render(<HojePage />);
    for (const label of Object.values(messages.hoje.links)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("reserves both dormant ad-slot placements at their final heights", () => {
    const { container } = render(<HojePage />);
    const desktop = container.querySelector<HTMLElement>(
      '[data-ad-placement="hub-desktop"]',
    );
    const mobile = container.querySelector<HTMLElement>(
      '[data-ad-placement="hub-mobile"]',
    );
    expect(desktop).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(desktop?.style.minHeight).toBe("60px");
    expect(mobile?.style.minHeight).toBe("64px");
  });

  it("never uses the frames' streak labels (amendment table: sequência)", () => {
    const { container } = render(<HojePage />);
    expect(container.textContent).not.toContain("dias seguidos");
  });
});
