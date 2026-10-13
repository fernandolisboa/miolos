import { FORBIDDEN_DAILY_KEYS, collectKeys } from "@miolos/core/testing";
import { generateQueens } from "@miolos/games/queens";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FREE_PLAY_DATE,
  FREE_PLAY_LEVELS,
  LEVEL_WEEKDAYS,
  type FreePlayLevel,
} from "../src/free-play/catalog";
import { QueensFreeScreen } from "../src/free-play/queens-free-screen";
import { useFreeQueens } from "../src/free-play/use-free-queens";
import { messages } from "../src/i18n";
import styles from "../src/queens/queens-board.module.css";
import { bodyOf, decl, stylesheet } from "./css-source";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

const SEED = 20_260_928;
const NEXT_SEED = 20_260_929;
const copy = messages.games.queens.play;
const LEVEL_SIZES = { leve: 7, medio: 8, dificil: 9 } as const;

function generated(seed: number, level: FreePlayLevel) {
  const deps = { pickSeed: () => seed };
  const { result } = renderHook(() => useFreeQueens(level, deps));
  const { phase } = result.current;
  if (phase.kind !== "ready") {
    throw new Error(`seed ${String(seed)} did not generate`);
  }
  return phase.puzzle;
}

function boardOf(size: number): HTMLElement {
  return screen.getByRole("group", { name: copy.boardAria(size) });
}

function cellAt(size: number, index: number): HTMLElement {
  const cell = boardOf(size).querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${String(index)}`);
  }
  return cell;
}

function chooseLevel(label: string): void {
  fireEvent.click(
    screen.getByRole("radio", { name: messages.freePlay.level.aria(label) }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a free Rainhas is today's wire shape, dated nowhere, sized by level (T-WEB-S477)", () => {
  it.each(FREE_PLAY_LEVELS)(
    "%s: carries FREE_PLAY_DATE, the level's board size, no solution, and regenerates identically",
    (level) => {
      const { seed, daily } = generated(SEED, level);

      expect(seed).toBe(SEED);
      expect(daily.date).toBe(FREE_PLAY_DATE);
      expect(daily.size).toBe(LEVEL_SIZES[level]);
      expect(daily.regions).toEqual(
        generateQueens({ seed: SEED, weekday: LEVEL_WEEKDAYS[level] }).regions,
      );
      expect(Object.keys(daily).sort()).toEqual([
        "date",
        "game",
        "regions",
        "size",
      ]);
      const forbidden = new Set<string>(FORBIDDEN_DAILY_KEYS);
      expect(
        [...collectKeys(daily)].filter((key) => forbidden.has(key)),
      ).toEqual([]);
      expect(generated(SEED, level)).toEqual({ seed, daily });
    },
  );
});

describe("a free Rainhas plays, solves and goes again with nothing recorded (T-WEB-S478)", () => {
  it("has no clock, solves to its own card, and 'Mais uma' draws a fresh board — zero fetch, zero writes", () => {
    const fetchMock = vi.fn(() => {
      throw new Error("free play must not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const seeds = [SEED, SEED, NEXT_SEED];
    const pickSeed = vi.fn(() => seeds.shift() ?? 0);
    const solution = generateQueens({
      seed: SEED,
      weekday: LEVEL_WEEKDAYS.leve,
    }).solution;

    render(<QueensFreeScreen deps={{ pickSeed }} />);
    chooseLevel("Leve");

    expect(screen.queryByText(messages.play.timerLabel)).toBeNull();

    for (const [index, mark] of solution.entries()) {
      if (mark === 1) {
        fireEvent.click(cellAt(7, index), { detail: 0 });
        fireEvent.click(cellAt(7, index), { detail: 0 });
      }
    }

    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(screen.getByText("Modo livre · Rainhas · Leve")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mais uma"));

    expect(pickSeed).toHaveBeenCalledTimes(3);
    const next = generated(NEXT_SEED, "leve").daily.regions;
    for (const [index, region] of next.entries()) {
      expect(cellAt(7, index).getAttribute("aria-label")).toBe(
        copy.cellAria(
          Math.floor(index / 7) + 1,
          (index % 7) + 1,
          region + 1,
          null,
          false,
        ),
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("a level switch remounts the Rainhas board (T-WEB-S479)", () => {
  it("resets the entries and regenerates at the level's size", () => {
    vi.stubGlobal("fetch", vi.fn());
    const seeds = [SEED, SEED + 1, SEED + 2];
    render(<QueensFreeScreen deps={{ pickSeed: () => seeds.shift() ?? 0 }} />);

    expect(boardOf(8).querySelectorAll("button")).toHaveLength(64);
    fireEvent.click(cellAt(8, 0), { detail: 0 });
    expect(cellAt(8, 0).className).toContain(styles.cellMarked);

    chooseLevel("Leve");
    expect(boardOf(7).querySelectorAll("button")).toHaveLength(49);
    for (const cell of boardOf(7).querySelectorAll("button")) {
      expect(cell.className).not.toContain(styles.cellMarked);
    }

    chooseLevel("Difícil");
    expect(boardOf(9).querySelectorAll("button")).toHaveLength(81);
  });
});

describe("the free Rainhas spends its one hint on the solution, once (T-WEB-S480)", () => {
  it("places the solution's first queen, then goes inert", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { solution } = generateQueens({
      seed: SEED,
      weekday: LEVEL_WEEKDAYS.medio,
    });
    const firstQueen = solution.indexOf(1);
    render(<QueensFreeScreen deps={{ pickSeed: () => SEED }} />);

    fireEvent.click(screen.getByText(copy.hint.available));

    expect(cellAt(8, firstQueen).querySelector("svg")).not.toBeNull();
    expect(cellAt(8, firstQueen).className).toContain(styles.cellHinted);
    expect(screen.getByText(copy.hint.used).closest("button")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText(copy.hint.explain.fill)).toBeInTheDocument();
  });
});

describe("a failed free Rainhas offers a retry that recovers (T-WEB-S481)", () => {
  it("shows the shared error card, then a board once retry generates", () => {
    let throws = true;
    const generate: NonNullable<
      Parameters<typeof useFreeQueens>[1]
    >["generate"] = (input) => {
      if (throws) {
        throws = false;
        throw new Error("generation failed");
      }
      return generateQueens(input);
    };

    render(<QueensFreeScreen deps={{ pickSeed: () => SEED, generate }} />);

    expect(screen.getByText(messages.freePlay.error.title)).toBeInTheDocument();

    fireEvent.click(screen.getByText(messages.freePlay.error.retry));

    expect(boardOf(8)).toBeInTheDocument();
  });
});

describe("the fifth free-play card is one column wide at both breakpoints (T-WEB-S482)", () => {
  const index = stylesheet("app/modo-livre/page.module.css");
  const mobile = bodyOf(index, "@media (max-width: 768px)");
  const ROTATION = /^rotate\(-?\d+(\.\d+)?deg\)$/;
  const TAPE = /^(translateX\(-50%\) )?rotate\(-?[3-5]deg\)$/;

  it("centres the fifth card under the pair rows on desktop", () => {
    const body = bodyOf(index, ".card:nth-child(5)");

    expect(decl(bodyOf(index, ".games"), "grid-template-columns")).toBe(
      "repeat(4, 1fr)",
    );
    expect(decl(bodyOf(index, ".card"), "grid-column")).toBe("span 2");
    expect(decl(body, "grid-column")).toBe("2 / 4");
    expect(body).not.toMatch(/\b(width|justify-self)\s*:/);
  });

  it("fills the single column on a phone", () => {
    expect(decl(bodyOf(mobile, ".games"), "display")).toBe("flex");
    expect(decl(bodyOf(mobile, ".games"), "flex-direction")).toBe("column");
    expect(bodyOf(mobile, ".card:nth-child(5)")).not.toMatch(/\bwidth\s*:/);
  });

  it.each([
    ["desktop", index],
    ["≤ 768px", mobile],
  ])("rotates the fifth card and its tape (%s)", (_label, css) => {
    expect(decl(bodyOf(css, ".card:nth-child(5)"), "transform")).toMatch(
      ROTATION,
    );
    expect(decl(bodyOf(css, ".card:nth-child(5) .tape"), "transform")).toMatch(
      TAPE,
    );
  });
});

describe("free Rainhas right click (T-WEB-S500c)", () => {
  it("places a queen with the right button through the shared board", () => {
    installPointerStubs();
    const { container } = render(
      <QueensFreeScreen deps={{ pickSeed: () => SEED }} />,
    );
    stubElementFromPoint(container);
    const board = boardOf(8);
    const at = {
      clientX: 3,
      clientY: 0,
      pointerId: 1,
      pointerType: "mouse",
      button: 2,
    };

    fireEvent.pointerDown(board, at);
    fireEvent.pointerUp(board, at);

    expect(cellAt(8, 3).getAttribute("aria-label")).toContain(": rainha");
    expect(fireEvent.contextMenu(board)).toBe(false);
  });
});
