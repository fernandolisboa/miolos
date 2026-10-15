import { GAMES, recordFor, type Game } from "@miolos/core";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HubProgress } from "../app/hub-day-state";
import { messages } from "../src/i18n";
import type { DayEntry } from "../src/play/day-state";
import { DAY_GAMES } from "../src/play/day-games";

const dayState = vi.hoisted(() => ({
  done: [] as readonly string[],
  played: [] as readonly string[],
}));

vi.mock("../src/play/day-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/play/day-state")>();
  return {
    ...actual,
    useDayState: (): Readonly<Record<Game, DayEntry>> =>
      recordFor(GAMES, (game) => ({
        status: dayState.done.includes(game)
          ? "completed"
          : dayState.played.includes(game)
            ? "played"
            : "pending",
        elapsedMs: undefined,
      })),
  };
});

function renderWith(done: readonly Game[], played: readonly Game[] = []) {
  dayState.done = done;
  dayState.played = played;
  return render(<HubProgress date="2026-10-15" />);
}

describe("the hub stamps a Dia Cheio and a Dia Perfeito, nothing before (T-WEB-S852)", () => {
  it("shows no stamp at 0, 1 or 2 games won", () => {
    for (let n = 0; n <= 2; n += 1) {
      const { container, unmount } = renderWith(DAY_GAMES.slice(0, n));
      expect(container.textContent).toBe(
        messages.hoje.completedOfTotal(n, DAY_GAMES.length),
      );
      expect(container.querySelector("[data-mark]")).toBeNull();
      unmount();
    }
  });

  it("stamps Dia Cheio from 3 up to one short of the lineup, and a lost Termo is not a win", () => {
    for (let n = 3; n < DAY_GAMES.length; n += 1) {
      const { container, unmount } = renderWith(DAY_GAMES.slice(0, n));
      const stamp = container.querySelector("[data-mark]");
      expect(stamp).toHaveAttribute("data-mark", "full");
      expect(stamp).toHaveTextContent(messages.dayMark.full);
      unmount();
    }

    const { container } = renderWith(["sudoku", "binairo"], ["termo"]);
    expect(container.querySelector("[data-mark]")).toBeNull();
  });

  it("stamps Dia Perfeito when every game of the day is won", () => {
    const { container } = renderWith(DAY_GAMES);
    const stamp = container.querySelector("[data-mark]");
    expect(stamp).toHaveAttribute("data-mark", "perfect");
    expect(stamp).toHaveTextContent(messages.dayMark.perfect);
    expect(container.textContent).toContain(
      messages.hoje.completedOfTotal(DAY_GAMES.length, DAY_GAMES.length),
    );
  });
});
