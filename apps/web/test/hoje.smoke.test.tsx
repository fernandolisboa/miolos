import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HojePage from "../app/page";
import { messages } from "../src/i18n";

// Smoke test for the Hoje screen (one per screen, spec seam 5). Every
// assertion goes through the messages module — never string literals —
// proving the copy is externalized.
describe("Hoje page", () => {
  it("renders the masthead, meta line and streak from the messages module", () => {
    render(<HojePage />);
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
