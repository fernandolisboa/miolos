import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HojePage from "../app/page";
import { messages, routes } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import {
  writePlayRecord,
  type BinairoPlayRecord,
} from "../src/play/play-record";

/**
 * The two dead "Estatísticas" links go live (#29, plan 033 D11.5): the hub
 * nav's anchor and the conclusion's "Ver estatísticas" both carry
 * `routes.stats` — the activation half T-WEB-S55/S101 pin for the game
 * tiles, applied to the statistics route.
 */
const DATE = "2026-07-31";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

function concludedBinairo(): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: Array.from({ length: 64 }, (_unused, index) =>
      index % 2 === 0 ? 0 : 1,
    ),
    elapsedMs: 407_000,
    hintsUsed: 0,
    concluded: true,
    // "pending" keeps the streak card and the stat block unmounted, so no
    // fetch fires — this suite is about two hrefs, nothing else.
    pendingSync: true,
    syncOutcome: "pending",
  };
}

beforeEach(() => {
  window.localStorage.clear();
  // The env stub and the fetch stub are a MANDATORY PAIR (plan 027 §8):
  // the hub's streak/attach islands fetch on mount, and the anonymous 401
  // keeps every shipped zero state.
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "no-session" }), { status: 401 }),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the two Estatísticas links carry routes.stats (T-WEB-S159)", () => {
  it("gives the hub nav's Estatísticas a real href, where it had none", () => {
    render(<HojePage />);

    const link = screen.getByText(messages.hoje.links.stats).closest("a");
    expect(link).toHaveAttribute("href", routes.stats);
    // The scope control: `arquivo` stays deliberately href-less (#31).
    expect(
      screen.getByText(messages.hoje.links.archive).closest("a"),
    ).not.toHaveAttribute("href");
  });

  it("gives the conclusion's 'Ver estatísticas' the same href", async () => {
    writePlayRecord(concludedBinairo());

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    const link = (await screen.findByText(messages.conclusion.stats)).closest(
      "a",
    );
    expect(link).toHaveAttribute("href", routes.stats);
  });
});
