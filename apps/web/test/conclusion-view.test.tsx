import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConclusionView } from "../src/binairo/conclusion-view";
import { writePlayRecord, type PlayRecord } from "../src/binairo/play-record";
import { formatElapsed, messages, routes } from "../src/i18n";

// T-WEB-17..T-WEB-20 (plan 017 §15). The conclusion is the same component
// in two places — swapped in place on /binairo when the grid closes (D26)
// and rendered under its own server segment at /binairo/concluido (D27) —
// so these tests drive the bookmarked path: a seeded record and a date.

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/binairo/sync", () => sync);

const DATE = "2026-07-30";
const ELAPSED_MS = 407_000;
const ELAPSED = formatElapsed(ELAPSED_MS);

function concluded(overrides: Partial<PlayRecord> = {}): PlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: Array.from({ length: 64 }, (_unused, index) =>
      index % 2 === 0 ? 0 : 1,
    ),
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("the stamp (T-WEB-17)", () => {
  it("renders the real elapsed time and the hint line, from the messages module", () => {
    writePlayRecord(concluded());

    render(<ConclusionView date={DATE} />);

    expect(
      screen.getByLabelText(messages.conclusao.stampAria(ELAPSED, 0)),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.conclusao.stampLabel)).toBeInTheDocument();
    expect(screen.getByText(messages.conclusao.hints(0))).toBeInTheDocument();
  });

  it("follows hintsUsed for the italic line under the time", () => {
    writePlayRecord(concluded({ hintsUsed: 1 }));

    render(<ConclusionView date={DATE} />);

    expect(screen.getByText(messages.conclusao.hints(1))).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusao.hints(0)),
    ).not.toBeInTheDocument();
  });

  it("keeps the <h1> the first element child of its wrapper", () => {
    writePlayRecord(concluded());

    render(<ConclusionView date={DATE} />);

    // The 52px h1 here would fire impeccable's hero-eyebrow-chip, and
    // `<article>` does not exempt that rule — so the wrapper is structural
    // on this screen too (§12.2).
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.previousElementSibling).toBeNull();
    expect(heading.parentElement?.firstElementChild).toBe(heading);
  });

  it("never uses the frames' streak labels (amendment table: sequência)", () => {
    writePlayRecord(concluded());

    const { container } = render(<ConclusionView date={DATE} />);

    expect(container.textContent).not.toContain("dias seguidos");
  });
});

describe("the day card and the CTA (T-WEB-18)", () => {
  it("shows Binairo done and the other three honestly missing", () => {
    writePlayRecord(concluded());

    render(<ConclusionView date={DATE} />);

    expect(
      screen.getByText(messages.conclusao.dayCard.title),
    ).toBeInTheDocument();
    // Three `falta` chips: no other game has a play route yet, and a fake
    // result would be worse than an honest gap (§12.3).
    expect(
      screen.getAllByText(messages.conclusao.dayCard.missing),
    ).toHaveLength(3);
    // Two nonogram labels — the short one is a distinct string, never a
    // runtime truncation; the media query hides one.
    expect(
      screen.getByText(messages.conclusao.dayCard.games.nonogram),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.conclusao.dayCard.games.nonogramShort),
    ).toBeInTheDocument();
  });

  it("points the CTA at Hoje and leaves the statistics link dead", () => {
    writePlayRecord(concluded());

    render(<ConclusionView date={DATE} />);

    expect(
      screen.getByText(messages.conclusao.cta).closest("a"),
    ).toHaveAttribute("href", routes.home);
    // #29 owns the statistics screen; Hoje's shipped links are href-less
    // for the same reason.
    expect(
      screen.getByText(messages.conclusao.stats).closest("a"),
    ).not.toHaveAttribute("href");
  });
});

describe("the sync line (T-WEB-19)", () => {
  it("says the result is queued while it is still pending", () => {
    writePlayRecord(concluded({ pendingSync: true, syncOutcome: "pending" }));

    render(<ConclusionView date={DATE} />);

    expect(
      screen.getByText(messages.conclusao.sync.pending),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusao.sync.rejected),
    ).not.toBeInTheDocument();
  });

  it("says so when the server refused it, and drops the pending line", () => {
    writePlayRecord(concluded({ syncOutcome: "rejected" }));

    render(<ConclusionView date={DATE} />);

    // Not cosmetic: without this line the stamp would stand while the
    // server holds no completion (ADR-0004, §9.2).
    expect(
      screen.getByText(messages.conclusao.sync.rejected),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusao.sync.pending),
    ).not.toBeInTheDocument();
  });

  it("says nothing once the completion is recorded", () => {
    writePlayRecord(concluded());

    render(<ConclusionView date={DATE} />);

    expect(
      screen.queryByText(messages.conclusao.sync.pending),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusao.sync.rejected),
    ).not.toBeInTheDocument();
  });
});

describe("no record for the server's day (T-WEB-20)", () => {
  it("explains the bookmark rather than redirecting it away", () => {
    render(<ConclusionView date={DATE} />);

    expect(
      screen.getByText(messages.conclusao.notYet.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.conclusao.notYet.body),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.conclusao.notYet.cta).closest("a"),
    ).toHaveAttribute("href", routes.binairo);
  });

  it("paints a skeleton before the record is read, never the notYet card", () => {
    writePlayRecord(concluded());

    // The server render IS the pre-hydration paint: `useSyncExternalStore`
    // takes the server snapshot, so this markup is exactly what the client
    // hydrates against. Flashing "ainda não concluído" and then swapping to
    // a completed stamp would be worse than a beat of nothing (D28).
    const markup = renderToStaticMarkup(<ConclusionView date={DATE} />);

    expect(markup).toContain('data-conclusion-state="skeleton"');
    expect(markup).not.toContain(messages.conclusao.notYet.title);
    expect(markup).not.toContain(messages.conclusao.stampLabel);
    expect(markup).not.toContain(ELAPSED);
  });
});
