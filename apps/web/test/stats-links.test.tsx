import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HojePage from "../app/page";
import { messages, routes } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import {
  writePlayRecord,
  type BinairoPlayRecord,
} from "../src/play/play-record";

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

    pendingSync: true,
    syncOutcome: "pending",
  };
}

beforeEach(() => {
  window.localStorage.clear();

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

    expect(
      screen.getByText(messages.hoje.links.archive).closest("a"),
    ).toHaveAttribute("href", routes.archive);
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
