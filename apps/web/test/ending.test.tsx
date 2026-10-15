import { render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveScreen } from "../src/archive/archive-screen";
import { LateResult } from "../src/archive/late-result";
import { FreePlaySolvedCard } from "../src/free-play/solved-card";
import { messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import { DailyScreen } from "../src/play/daily-screen";
import { JustEnded } from "../src/play/just-ended";
import {
  writePlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";
import type { PlayCore } from "../src/play/types";
import { GameSettings } from "../src/settings/game-settings";
import { readSettings, writeSettings } from "../src/settings/settings";
import { bodyOf, decl, stylesheet } from "./css-source";
import { parseCss, uncoveredSelectors } from "./reduced-motion";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));

function Witness() {
  return (
    <div data-testid="witness" data-ended={String(useContext(JustEnded))} />
  );
}

vi.mock("../src/play/conclusion-lazy", () => ({
  ConclusionView: () => <Witness />,
  RemoteConclusionView: () => <div data-testid="remote" />,
  preloadConclusionView: vi.fn(),
}));

const DATE = "2026-07-30";

const OPEN: PlayCore = {
  date: DATE,
  timer: { accumulatedMs: 5_000, runningSince: 8_000 },
  status: "playing",
  pendingSync: false,
  now: 9_000,
  hydrated: true,
};
const SOLVED: PlayCore = {
  ...OPEN,
  timer: { accumulatedMs: 6_000, runningSince: null },
  status: "solved",
};
const UNREAD: PlayCore = { ...OPEN, hydrated: false };

const daily = (state: PlayCore) => (
  <DailyScreen
    game="sudoku"
    claim={undefined}
    state={state}
    skeleton={<div data-testid="skeleton" />}
    view={<div data-testid="view" />}
    result={{ elapsedMs: 6_000, hintsUsed: 0 }}
  />
);

const archive = (state: PlayCore) => (
  <ArchiveScreen
    game="sudoku"
    state={state}
    skeleton={<div data-testid="skeleton" />}
    view={<div data-testid="view" />}
  />
);

function ended(): string | null {
  return screen.getByTestId("witness").getAttribute("data-ended");
}

function flourish(): HTMLElement | null {
  return document.querySelector("[data-ending]");
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
});

describe("a daily ends in front of the player only after the board was shown (T-WEB-S740)", () => {
  it("is just ended when the board swapped to the result in this mount", () => {
    const { rerender } = render(daily(UNREAD));
    rerender(daily(OPEN));
    rerender(daily(SOLVED));

    expect(ended()).toBe("true");
  });

  it("reaches a game's own conclusion render too, as Termo and Nonogram use", () => {
    const own = (state: PlayCore) => (
      <DailyScreen
        game="termo"
        claim={undefined}
        state={state}
        skeleton={<div data-testid="skeleton" />}
        view={<div data-testid="view" />}
        conclusion={{ render: () => <Witness />, preload: vi.fn() }}
      />
    );
    const { rerender } = render(own(UNREAD));
    rerender(own(OPEN));
    rerender(own({ ...SOLVED, status: "lost" }));

    expect(ended()).toBe("true");
  });

  it("is not just ended when another device's result replaced the board", () => {
    const claimed = (state: PlayCore) => (
      <DailyScreen
        game="sudoku"
        claim={{ status: "completed", elapsedMs: 1, hintsUsed: 0 }}
        state={state}
        skeleton={<div data-testid="skeleton" />}
        view={<div data-testid="view" />}
        result={{ elapsedMs: 6_000, hintsUsed: 0 }}
      />
    );
    const { rerender } = render(claimed(OPEN));
    expect(screen.getByTestId("remote")).toBeInTheDocument();
    rerender(claimed(SOLVED));

    expect(ended()).toBe("false");
  });

  it("is not just ended when the record was already concluded on load", () => {
    const { rerender } = render(daily(UNREAD));
    rerender(daily(SOLVED));

    expect(ended()).toBe("false");
  });
});

describe("an archive day follows the same rule (T-WEB-S741)", () => {
  it("plays the flourish after the board, and not on a revisit", () => {
    const played = render(archive(OPEN));
    played.rerender(archive(SOLVED));
    expect(flourish()?.getAttribute("data-ending")).toBe("won");
    played.unmount();

    render(archive(SOLVED));
    expect(flourish()).toBeNull();
  });

  it("shows the lost flourish on a lost day", () => {
    render(
      <JustEnded value>
        <LateResult
          game="termo"
          date={DATE}
          outcome="lost"
          alreadyConcluded={false}
        />
      </JustEnded>,
    );

    expect(flourish()?.getAttribute("data-ending")).toBe("lost");
  });
});

describe("the conclusion carries the flourish beside its stamp (T-WEB-S742)", () => {
  const SUDOKU: SudokuPlayRecord = {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    grid: Array.from(
      { length: 9 },
      () => [1, 2, 3, 4, 5, 6, 7, 8, 9] as const,
    ).flat(),
    elapsedMs: 512_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };

  const LOST = {
    state: "lost",
    label: "Jogado",
    detail: "X/6",
    aria: "lost",
  } as const;

  it("presses the stamp on a win that just ended", () => {
    writePlayRecord(SUDOKU);
    render(
      <JustEnded value>
        <ConclusionView
          game="sudoku"
          date={DATE}
          copy={messages.games.sudoku.conclusion}
        />
      </JustEnded>,
    );

    const overlay = flourish();
    expect(overlay?.getAttribute("data-ending")).toBe("won");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("lets the ink run on a loss that just ended", () => {
    render(
      <JustEnded value>
        <ConclusionView
          game="termo"
          date={DATE}
          copy={messages.games.termo.conclusion}
          outcome={LOST}
        />
      </JustEnded>,
    );

    expect(flourish()?.getAttribute("data-ending")).toBe("lost");
  });

  it("stays calm when the conclusion is only revisited", () => {
    writePlayRecord(SUDOKU);
    render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );

    expect(flourish()).toBeNull();
  });
});

describe("free play always ends in front of the player (T-WEB-S743)", () => {
  it("presses the stamp on a solved board", () => {
    render(<FreePlaySolvedCard game="sudoku" onAgain={() => undefined} />);

    expect(flourish()?.getAttribute("data-ending")).toBe("won");
  });

  it("lets the ink run on a lost Termo", () => {
    render(
      <FreePlaySolvedCard
        game="termo"
        word={{ canonical: "ÁBACO", won: false }}
        onAgain={() => undefined}
      />,
    );

    expect(flourish()?.getAttribute("data-ending")).toBe("lost");
  });
});

describe("the end animation is a device setting, on by default (T-WEB-S744)", () => {
  it("defaults on, and a junk value falls back to on", () => {
    expect(readSettings().endAnimation).toBe(true);

    window.localStorage.setItem(
      "miolos-settings",
      JSON.stringify({ endAnimation: "yes" }),
    );
    expect(readSettings().endAnimation).toBe(true);
  });

  it("switched off, no screen plays it", () => {
    writeSettings({ ...readSettings(), endAnimation: false });

    render(<FreePlaySolvedCard game="sudoku" onAgain={() => undefined} />);
    render(
      <JustEnded value>
        <LateResult
          game="sudoku"
          date={DATE}
          outcome="won"
          alreadyConcluded={false}
        />
      </JustEnded>,
    );

    expect(flourish()).toBeNull();
  });
});

describe("the general group always offers the switch (T-WEB-S745)", () => {
  const copy = messages.settings.games;

  it("shows it without the clock where a game has none, and saves it", () => {
    render(<GameSettings games={[]} clock={false} />);

    const general = screen.getByRole("group", { name: copy.general });
    const toggle = screen.getByRole("switch", {
      name: copy.flags.endAnimation.label,
    });
    expect(general).toContainElement(toggle);
    expect(
      screen.queryByRole("switch", { name: copy.flags.showClock.label }),
    ).toBeNull();

    toggle.click();
    expect(readSettings().endAnimation).toBe(false);
  });
});

describe("the flourish is ink on paper, and calm under reduced motion (T-WEB-S746)", () => {
  const CSS = stylesheet("src/play/ending-flourish.module.css");
  const KEYFRAMES = [...CSS.matchAll(/@keyframes\s+([\w-]+)/g)].map(
    (match) => match[1],
  );

  it("names a keyframe for the press, the splash and the heavy drop", () => {
    expect(KEYFRAMES).toEqual(
      expect.arrayContaining([
        "ending-press",
        "ending-ring",
        "ending-flick",
        "ending-drop",
        "ending-dust",
      ]),
    );
  });

  it("never bounces or loops", () => {
    expect(CSS).not.toMatch(/bounce|elastic|wobble|jiggle|spring/i);
    expect(CSS).not.toMatch(/\binfinite\b|\balternate\b/);
  });

  it("presses down from above, and the loss drops heavily and rocks to rest", () => {
    const press = bodyOf(CSS, "@keyframes ending-press");
    const scales = [...press.matchAll(/scale\(([\d.]+)\)/g)].map((match) =>
      Number(match[1]),
    );
    expect(scales.length).toBeGreaterThan(0);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(1);
    expect(decl(bodyOf(press, "to"), "transform")).toBe("none");
    expect(decl(bodyOf(CSS, ".press"), "animation")).toContain(
      "var(--ease-settle)",
    );

    const drop = bodyOf(CSS, "@keyframes ending-drop");
    const fall = decl(bodyOf(drop, "0%"), "animation-timing-function") ?? "";
    const curve = /cubic-bezier\(([^)]+)\)/.exec(fall)?.[1] ?? "";
    const [, y1, , y2] = curve.split(",").map(Number);
    expect([y1, y2]).toEqual([0, expect.any(Number)]);
    expect(Math.max(y1 ?? 2, y2 ?? 2)).toBeLessThanOrEqual(1);
    expect(decl(bodyOf(drop, "100%"), "transform")).toBe("none");
    expect(drop).not.toMatch(/accent/);
  });

  it("paints only with the system's tokens", () => {
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(decl(bodyOf(CSS, ".ring"), "border-color")).toBe("var(--accent)");
    expect(decl(bodyOf(CSS, ".dust"), "background")).toBe("var(--ink-2)");
  });

  it("stands every animated piece down by name", () => {
    expect(uncoveredSelectors(parseCss(CSS))).toEqual([]);
  });
});
