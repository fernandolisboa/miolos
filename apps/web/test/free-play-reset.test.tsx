import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";

import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { QueensFreeScreen } from "../src/free-play/queens-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
import hintCardStyles from "../src/play/hint-card.module.css";
import screenStyles from "../src/play/screen.module.css";
import { flushGeneration } from "./free-generation";
import { hintCardLoaded } from "./hint-reason";

const SEED = 20_261_013;
const DEPS = { pickSeed: () => SEED };
const reset = messages.play.reset;
const hint = messages.play.hint;

const SCREENS: readonly {
  readonly name: string;
  readonly screen: ReactElement;
}[] = [
  {
    name: "Sudoku",
    screen: <SudokuFreeScreen deps={DEPS} />,
  },
  {
    name: "Nonogram",
    screen: <NonogramFreeScreen deps={DEPS} />,
  },
  {
    name: "Binairo",
    screen: <BinairoFreeScreen deps={DEPS} />,
  },
  {
    name: "Rainhas",
    screen: <QueensFreeScreen deps={DEPS} />,
  },
  {
    name: "Cruzadinha",
    screen: <CrosswordFreeScreen deps={DEPS} />,
  },
];

function cells(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll("[data-cell-index]")].map(
    (cell) => cell.outerHTML,
  );
}

function explanation(container: HTMLElement): Element | null {
  return container.querySelector(`.${screenStyles.hintLive ?? ""} p`);
}

function hintCard(container: HTMLElement): Element | null {
  return container.querySelector(`.${hintCardStyles.card ?? ""}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Recomeçar in free play clears the board and keeps the hint spent (T-WEB-S517)", () => {
  it.each(SCREENS)(
    "$name: the board, the hinted cell, the explanation and its card go; the spent hint stays; nothing is written",
    async ({ screen: element }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => {
          throw new Error("free play must not fetch");
        }),
      );
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const { container } = render(element);
      await flushGeneration();
      const fresh = cells(container);
      expect(screen.getByRole("button", { name: reset.label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );

      fireEvent.click(screen.getByText(hint.available(FREE_HINTS_PER_PUZZLE)));
      await hintCardLoaded();
      expect(cells(container)).not.toEqual(fresh);
      expect(explanation(container)).not.toBeNull();
      expect(hintCard(container)).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: reset.label }));
      fireEvent.click(
        within(screen.getByRole("group", { name: reset.question })).getByRole(
          "button",
          {
            name: reset.label,
          },
        ),
      );

      expect(cells(container)).toEqual(fresh);
      expect(screen.getByRole("button", { name: reset.label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(explanation(container)).toBeNull();
      expect(hintCard(container)).toBeNull();
      expect(
        screen.getByText(hint.available(FREE_HINTS_PER_PUZZLE - 1)),
      ).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: reset.question })).toBeNull();
      expect(setItem).not.toHaveBeenCalled();
    },
  );
});
