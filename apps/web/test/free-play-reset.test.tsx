import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
import screenStyles from "../src/play/screen.module.css";

const SEED = 20_261_013;
const DEPS = { pickSeed: () => SEED };
const reset = messages.play.reset;

const SCREENS: readonly {
  readonly name: string;
  readonly screen: ReactElement;
  readonly hint: { readonly available: string; readonly used: string };
}[] = [
  {
    name: "Sudoku",
    screen: <SudokuFreeScreen deps={DEPS} />,
    hint: messages.games.sudoku.play.hint,
  },
  {
    name: "Nonogram",
    screen: <NonogramFreeScreen deps={DEPS} />,
    hint: messages.games.nonogram.play.hint,
  },
  {
    name: "Cruzadinha",
    screen: <CrosswordFreeScreen deps={DEPS} />,
    hint: messages.games.crossword.play.hint,
  },
];

function cells(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll("[data-cell-index]")].map(
    (cell) => cell.outerHTML,
  );
}

function explanation(container: HTMLElement): Element | null {
  return container.querySelector(`.${screenStyles.hintExplain ?? ""}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Recomeçar in free play clears the board and keeps the hint spent (T-WEB-S501)", () => {
  it.each(SCREENS)(
    "$name: the board, the hinted cell and the explanation go; the spent hint stays; nothing is written",
    ({ screen: element, hint }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => {
          throw new Error("free play must not fetch");
        }),
      );
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const { container } = render(element);
      const empty = cells(container);
      expect(screen.getByRole("button", { name: reset.label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );

      fireEvent.click(screen.getByText(hint.available));
      expect(cells(container)).not.toEqual(empty);
      expect(explanation(container)).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: reset.label }));
      fireEvent.click(
        within(screen.getByRole("group", { name: reset.question })).getByRole(
          "button",
          {
            name: reset.label,
          },
        ),
      );

      expect(cells(container)).toEqual(empty);
      expect(screen.getByRole("button", { name: reset.label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(explanation(container)).toBeNull();
      expect(screen.getByText(hint.used).closest("button")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(screen.queryByRole("group", { name: reset.question })).toBeNull();
      expect(setItem).not.toHaveBeenCalled();
    },
  );
});
