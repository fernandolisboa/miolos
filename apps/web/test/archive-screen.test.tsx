import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveScreen } from "../src/archive/archive-screen";
import { messages } from "../src/i18n";
import type { PlayCore } from "../src/play/types";

const stubs = vi.hoisted(() => ({
  usePriorConclusion: vi.fn((): boolean => false),
}));

vi.mock("../src/archive/use-prior-conclusion", () => ({
  usePriorConclusion: stubs.usePriorConclusion,
}));

vi.mock("../src/archive/late-result", () => ({
  LateResult: (props: Record<string, unknown>) => (
    <div data-testid="late" data-props={JSON.stringify(props)} />
  ),
}));

const DATE = "2026-03-02";

const OPEN: PlayCore = {
  date: DATE,
  timer: { accumulatedMs: 5_000, runningSince: 8_000 },
  status: "playing",
  now: 9_000,
  hydrated: true,
};

const SOLVED: PlayCore = {
  ...OPEN,
  timer: { accumulatedMs: 6_000, runningSince: null },
  status: "solved",
};

function archiveScreen(state: PlayCore, unavailable?: boolean) {
  return (
    <ArchiveScreen
      game="binairo"
      state={state}
      unavailable={unavailable}
      skeleton={<div data-testid="skeleton" />}
      view={<div data-testid="view" />}
    />
  );
}

function lateProps(): unknown {
  return JSON.parse(
    screen.getByTestId("late").getAttribute("data-props") ?? "null",
  );
}

beforeEach(() => {
  stubs.usePriorConclusion.mockReset();
  stubs.usePriorConclusion.mockReturnValue(false);
});

describe("the archive ladder, rung by rung (T-WEB-S484)", () => {
  it("says the day is unavailable before anything else", () => {
    render(archiveScreen({ ...OPEN, hydrated: false }, true));

    expect(
      screen.getByText(messages.games.binairo.play.unavailable.title),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });

  it("paints the skeleton until the record is read", () => {
    render(archiveScreen({ ...OPEN, hydrated: false }));

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("shows a won board as a late result", () => {
    render(archiveScreen(SOLVED));

    expect(lateProps()).toEqual({
      game: "binairo",
      date: DATE,
      outcome: "won",
      alreadyConcluded: false,
    });
    expect(screen.queryByTestId("view")).toBeNull();
  });

  it("shows a lost board as a late result", () => {
    render(archiveScreen({ ...SOLVED, status: "lost" }));

    expect(lateProps()).toMatchObject({ outcome: "lost" });
  });

  it("tells the late result when the day was already concluded", () => {
    stubs.usePriorConclusion.mockReturnValue(true);
    render(archiveScreen(SOLVED));

    expect(stubs.usePriorConclusion).toHaveBeenCalledWith("binairo", DATE);
    expect(lateProps()).toMatchObject({ alreadyConcluded: true });
  });

  it("plays the board while its clock is running", () => {
    render(archiveScreen(OPEN));

    expect(screen.getByTestId("view")).toBeInTheDocument();
    expect(screen.queryByTestId("late")).toBeNull();
  });
});
