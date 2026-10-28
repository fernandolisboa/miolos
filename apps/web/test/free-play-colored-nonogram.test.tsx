import { generateColoredNonogram } from "@miolos/games/colored-nonogram";
import { generateNonogram } from "@miolos/games/nonogram";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import styles from "../src/colored-nonogram/colored-board.module.css";
import { coloredCopy, toneName } from "../src/colored-nonogram/copy";
import { LEVEL_WEEKDAYS } from "../src/free-play/catalog";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { messages } from "../src/i18n";
import pictureStyles from "../src/play/picture-art.module.css";
import { flushGeneration } from "./free-generation";

const chunk = vi.hoisted(() => ({ failures: 1 }));
const card = vi.hoisted(() => ({ failures: 0, loads: 0 }));

vi.mock("../src/free-play/picture-solved-card", async (importOriginal) => {
  card.loads += 1;
  if (card.failures > 0) {
    card.failures -= 1;
    throw new Error("chunk load failed (test)");
  }
  return importOriginal();
});

vi.mock(
  "../src/free-play/colored-nonogram-free-screen",
  async (importOriginal) => {
    if (chunk.failures > 0) {
      chunk.failures -= 1;
      throw new Error("chunk load failed (test)");
    }
    return importOriginal();
  },
);

const SEED = 20_260_801;
const LEVE = generateColoredNonogram(SEED, 5);

function seeds() {
  return { pickSeed: () => SEED };
}

function cells(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-cell-index]")];
}

function cellAt(index: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell ${String(index)}`);
  }
  return cell;
}

function radio(name: string): HTMLElement {
  return screen.getByRole("radio", { name });
}

function coresToggle(): HTMLElement {
  return screen.getByRole("button", { name: variant.aria(variant.cores) });
}

const variant = messages.freePlay.variant;
const level = messages.freePlay.level;

function chips(): number {
  return document.querySelectorAll(`.${styles.chip ?? ""}`).length;
}

async function coloredBoard(): Promise<void> {
  await waitFor(() => {
    expect(chips()).toBeGreaterThan(0);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function solveMedio(): number {
  const medio = generateNonogram(SEED, LEVEL_WEEKDAYS.medio);
  medio.reveal.solution.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (filled) {
        fireEvent.click(cellAt(y * medio.size + x));
      }
    });
  });
  return medio.size;
}

describe("Variante picks Clássico or Cores, Cores loads on demand at the current level (T-WEB-S877)", () => {
  it("shows the error card when the solved card fails to load, and its retry deals a fresh board", async () => {
    card.failures = 3;
    vi.stubGlobal("fetch", vi.fn());
    render(<NonogramFreeScreen deps={seeds()} />);
    await flushGeneration();

    const size = solveMedio();
    expect(
      await screen.findByText(messages.freePlay.error.title),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: messages.freePlay.error.retry }),
    );
    await flushGeneration();
    expect(screen.queryByText(messages.freePlay.error.title)).toBeNull();
    expect(screen.queryByText(messages.freePlay.solved.stamp)).toBeNull();
    expect(cells().map((cell) => cell.getAttribute("aria-label"))).toEqual(
      Array.from({ length: size ** 2 }, (_unused, index) =>
        messages.games.nonogram.play.cellAria(
          Math.floor(index / size) + 1,
          (index % size) + 1,
          null,
        ),
      ),
    );
  });

  it("loads the lazy solved card again when it mounts, after the board's preload failed", async () => {
    card.failures = 1;
    card.loads = 0;
    vi.stubGlobal("fetch", vi.fn());
    render(<NonogramFreeScreen deps={seeds()} />);
    await flushGeneration();
    await waitFor(() => {
      expect(card.loads).toBe(1);
    });

    solveMedio();

    expect(
      await screen.findByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(card.loads).toBe(2);
  });

  it("shows the error card when the Cores chunk fails, and the retry loads it", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<NonogramFreeScreen deps={seeds()} />);
    await flushGeneration();

    fireEvent.click(coresToggle());
    expect(
      await screen.findByText(messages.freePlay.error.title),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: messages.freePlay.error.retry }),
    );
    await coloredBoard();
    expect(screen.queryByText(messages.freePlay.error.title)).toBeNull();
  });

  it("starts on Clássico, switches to Cores at the same level, and keeps Cores across a level change", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<NonogramFreeScreen deps={seeds()} />);
    await flushGeneration();

    expect(
      screen.queryByRole("radio", { name: variant.aria(variant.classico) }),
    ).toBeNull();
    expect(coresToggle()).toHaveAttribute("aria-pressed", "false");
    expect(cells()).toHaveLength(100);
    expect(chips()).toBe(0);

    coresToggle().focus();
    fireEvent.click(coresToggle());
    await coloredBoard();
    expect(coresToggle()).toHaveAttribute("aria-pressed", "true");
    expect(document.activeElement).toBe(coresToggle());
    expect(cells()).toHaveLength(100);

    fireEvent.click(radio(level.aria(level.leve)));
    await flushGeneration();
    await coloredBoard();
    expect(cells()).toHaveLength(25);
    expect(coresToggle()).toHaveAttribute("aria-pressed", "true");

    coresToggle().focus();
    fireEvent.click(coresToggle());
    await flushGeneration();
    expect(coresToggle()).toHaveAttribute("aria-pressed", "false");
    expect(document.activeElement).toBe(coresToggle());
    expect(cells()).toHaveLength(25);
    expect(chips()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("solves in Cores to a card that names the variant and a picture painted in the puzzle's tones, wiping in", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<NonogramFreeScreen deps={seeds()} />);
    await flushGeneration();
    fireEvent.click(radio(level.aria(level.leve)));
    await flushGeneration();
    fireEvent.click(coresToggle());
    await coloredBoard();

    const { palette } = LEVE.clues;
    palette.forEach((letter, at) => {
      fireEvent.click(
        screen.getByRole("button", {
          name: coloredCopy.swatchAria(toneName(palette, at + 1)),
        }),
      );
      LEVE.solution.forEach((mark, index) => {
        if (mark === at + 1) {
          fireEvent.click(cellAt(index));
        }
      });
    });

    expect(
      await screen.findByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.freePlay.solved.modeLine(
          messages.freePlay.modeTag,
          messages.games.nonogram.name,
          level.leve,
          variant.cores,
        ),
      ),
    ).toBeInTheDocument();

    const picture = await screen.findByRole("img", {
      name: messages.freePlay.solved.pictureAria,
    });
    const toned = picture.querySelector("[data-toned]");
    expect(toned?.getAttribute("class")).toBe(String(pictureStyles.wipe));
    const fills = [
      ...picture.querySelectorAll<SVGPathElement>("[data-toned] path[style]"),
    ].map((path) => path.style.fill);
    expect(fills.sort()).toEqual(
      palette.map((letter) => `var(--tone-${letter})`).sort(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
