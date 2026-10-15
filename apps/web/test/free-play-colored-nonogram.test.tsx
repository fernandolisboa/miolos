import { generateColoredNonogram } from "@miolos/games/colored-nonogram";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import styles from "../src/colored-nonogram/colored-board.module.css";
import { coloredCopy } from "../src/colored-nonogram/copy";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { messages } from "../src/i18n";
import pictureStyles from "../src/play/picture-art.module.css";
import { flushGeneration } from "./free-generation";

const chunk = vi.hoisted(() => ({ failures: 1 }));

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

describe("Variante picks Clássico or Cores, Cores loads on demand at the current level (T-WEB-S877)", () => {
  it("shows the error card when the Cores chunk fails, and the retry loads it", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<NonogramFreeScreen deps={seeds()} />);
    await flushGeneration();

    fireEvent.click(radio(variant.aria(variant.cores)));
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

    expect(radio(variant.aria(variant.classico))).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(cells()).toHaveLength(100);
    expect(chips()).toBe(0);

    fireEvent.click(radio(variant.aria(variant.cores)));
    await coloredBoard();
    expect(radio(variant.aria(variant.cores))).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(cells()).toHaveLength(100);

    fireEvent.click(radio(level.aria(level.leve)));
    await flushGeneration();
    await coloredBoard();
    expect(cells()).toHaveLength(25);
    expect(radio(variant.aria(variant.cores))).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(radio(variant.aria(variant.classico)));
    await flushGeneration();
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
    fireEvent.click(radio(variant.aria(variant.cores)));
    await coloredBoard();

    const { palette } = LEVE.clues;
    palette.forEach((letter, at) => {
      fireEvent.click(
        screen.getByRole("button", {
          name: coloredCopy.swatchAria(coloredCopy.toneName(letter)),
        }),
      );
      LEVE.solution.forEach((mark, index) => {
        if (mark === at + 1) {
          fireEvent.click(cellAt(index));
        }
      });
    });

    expect(
      screen.getByText(messages.freePlay.solved.stamp),
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
