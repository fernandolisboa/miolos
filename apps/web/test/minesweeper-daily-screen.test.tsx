import {
  dailyMinesweeperResponseSchema,
  type DailyMinesweeperResponse,
  type DayGameState,
} from "@miolos/core";
import { generateMinesweeperDaily } from "@miolos/games/minesweeper";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveMinesweeperScreen } from "../src/archive/minesweeper-screen";
import { formatElapsed, messages } from "../src/i18n";
import { minesweeperMessages } from "../src/minesweeper/messages";
import { MinesweeperScreen } from "../src/minesweeper/minesweeper-screen";
import { RemoteConclusionView } from "../src/play/conclusion-view";
import type { MinesweeperPlayRecord } from "../src/play/play-record";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn((record?: MinesweeperPlayRecord) =>
    Promise.resolve(record),
  ),
}));
vi.mock("../src/play/sync", () => sync);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/campo-minado",
}));

const DATE = "2026-10-16";
const GENERATED = generateMinesweeperDaily({ seed: 20_261_016, weekday: 5 });
const DAILY: DailyMinesweeperResponse = dailyMinesweeperResponseSchema.parse({
  game: "minesweeper",
  date: DATE,
  rows: GENERATED.rows,
  columns: GENERATED.columns,
  mines: GENERATED.mines,
  start: GENERATED.start,
});
const MINES = DAILY.mines.filter((cell) => cell === 1).length;
const copy = messages.games.minesweeper.conclusion;

function cell(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (found === null) {
    throw new Error(`no cell ${String(index)}`);
  }
  return found;
}

function hidden(index: number): boolean {
  return (
    cell(index)
      .getAttribute("aria-label")
      ?.endsWith(minesweeperMessages.cell.hidden) ?? false
  );
}

function playToEnd(win: boolean): void {
  if (!win) {
    fireEvent.click(cell(DAILY.mines.indexOf(1)));
    return;
  }
  DAILY.mines.forEach((mine, index) => {
    if (mine === 0 && document.querySelector("[data-cell-index]") !== null) {
      if (hidden(index)) {
        fireEvent.click(cell(index));
      }
    }
  });
}

async function settle(): Promise<void> {
  await act(async () => {
    await import("../src/minesweeper/minesweeper-conclusion");
  });
}

function expectNoAssists(): void {
  expect(
    screen.queryByRole("button", { name: /dica/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: messages.play.undo }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/recomeçar/i)).not.toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the daily Campo Minado is the free board on the published field, with no assists (T-WEB-S923)", () => {
  it.each([
    ["today", () => <MinesweeperScreen daily={DAILY} />],
    ["the archive", () => <ArchiveMinesweeperScreen daily={DAILY} />],
  ])(
    "%s opens at the start, counts mines, offers Abrir|Bandeira and nothing else",
    (_where, mount) => {
      render(mount());

      expect(document.querySelectorAll("[data-cell-index]")).toHaveLength(
        DAILY.rows * DAILY.columns,
      );
      expect(hidden(DAILY.start)).toBe(false);
      expect(
        screen.getAllByText(minesweeperMessages.progressLong(MINES)).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByRole("button", {
          name: minesweeperMessages.tap.open,
          pressed: true,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: minesweeperMessages.tap.flag }),
      ).toBeInTheDocument();
      expectNoAssists();
    },
  );

  it("runs the clock from the moment the board shows, before any open", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    render(<MinesweeperScreen daily={DAILY} />);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getAllByRole("timer")[0]).toHaveTextContent("00:03");
  });

  it("ends a loss on the played stamp over the finished field, and posts the hit", async () => {
    render(<MinesweeperScreen daily={DAILY} />);
    playToEnd(false);
    await settle();

    expect(
      screen.getByRole("img", { name: copy.played.aria }),
    ).toHaveTextContent(copy.played.label);
    expect(
      screen.getByRole("img", {
        name: minesweeperMessages.finishedAria(false),
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(messages.conclusion.stampLabel)).toBeNull();
    const [queued] = sync.flushPendingCompletions.mock.calls.at(-1) ?? [];
    expect(queued).toMatchObject({
      game: "minesweeper",
      concluded: true,
      hit: DAILY.mines.indexOf(1),
    });
  });

  it("ends a win on the time stamp over the solved field, with no hit", async () => {
    render(<MinesweeperScreen daily={DAILY} />);
    playToEnd(true);
    await settle();

    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: minesweeperMessages.finishedAria(true) }),
    ).toBeInTheDocument();
    const [queued] = sync.flushPendingCompletions.mock.calls.at(-1) ?? [];
    expect(queued).toMatchObject({ game: "minesweeper", hit: null });
  });
});

describe("a Campo Minado played on another device opens on the played stamp (T-WEB-S924)", () => {
  function remote(claim: DayGameState) {
    return render(
      <RemoteConclusionView
        game="minesweeper"
        date={DATE}
        copy={copy}
        claim={claim}
      />,
    );
  }

  it("stamps a played claim with the game's own loss copy, no time", () => {
    const { container } = remote({ status: "played" });

    expect(
      screen.getByRole("img", { name: copy.played.aria }),
    ).toHaveTextContent(copy.played.label);
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "lost",
    );
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
  });

  it("stamps a completed claim with its time, as every timed game does", () => {
    remote({ status: "completed", elapsedMs: 95_000, hintsUsed: 0 });

    expect(screen.queryByRole("img", { name: copy.played.aria })).toBeNull();
    expect(screen.getByText(formatElapsed(95_000))).toBeInTheDocument();
  });
});
