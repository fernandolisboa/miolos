import { fireEvent, render, screen as dom } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FreePlayChrome } from "../src/free-play/chrome";
import { DailyPlayChrome } from "../src/play/daily-chrome";
import { messages } from "../src/i18n";
import { minesweeperMessages } from "../src/minesweeper/messages";
import type { PlayChromeReadouts } from "../src/play/screen-chrome";
import shared from "../src/play/screen.module.css";

const copy = { ...messages.games.minesweeper.play, ...minesweeperMessages };
const noop = () => undefined;

function readouts(onReset: (() => void) | null): PlayChromeReadouts {
  return {
    progressShort: copy.progressShort(10),
    progressLong: copy.progressLong(10),
    hint: null,
    onReset,
  };
}

function minefieldChrome(onReset: (() => void) | null) {
  return render(
    <FreePlayChrome
      game="minesweeper"
      pageModifier="page-minesweeper"
      clock={{ elapsedMs: 65_000 }}
      state={{ kind: "playing", readouts: readouts(onReset) }}
    >
      <div className={shared.gridCard} />
    </FreePlayChrome>,
  );
}

describe("the chrome serves Campo Minado with no hint, no undo and its own Novo jogo (T-WEB-S881)", () => {
  it("draws no hint bar and no Desfazer, and leaves the page five children", () => {
    const { container } = minefieldChrome(noop);
    const page = container.querySelector(`.${shared.page ?? ""}`);

    expect(
      dom.queryByRole("button", { name: /dica/i }),
    ).not.toBeInTheDocument();
    expect(
      dom.queryByRole("button", { name: messages.play.undo }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(`.${shared.hint ?? ""}`)).toBeNull();
    expect(page?.children).toHaveLength(5);
    expect(page).toHaveAttribute("data-play-state", "playing");
  });

  it("takes the title, kicker and rules from its own copy, and the timer from the clock prop", () => {
    const { container } = minefieldChrome(noop);

    expect(
      dom.getByRole("heading", { level: 1, name: copy.title }),
    ).toBeInTheDocument();
    expect(dom.getAllByText(copy.progressLong(10))).not.toHaveLength(0);
    expect(dom.getAllByRole("timer")[0]).toHaveTextContent("01:05");
    expect(container.querySelector("main")?.getAttribute("style")).toContain(
      "--accent-minesweeper",
    );
  });

  it("asks Novo jogo in its own words, and is idle until there is something to lose", () => {
    const onReset = vi.fn();
    const { rerender } = minefieldChrome(onReset);
    const trigger = dom.getByRole("button", { name: copy.reset.label });

    fireEvent.click(trigger);
    expect(dom.getByText(copy.reset.question)).toBeInTheDocument();
    fireEvent.click(
      dom.getByRole("button", { name: copy.reset.label, hidden: true }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <FreePlayChrome
        game="minesweeper"
        pageModifier="page-minesweeper"
        state={{ kind: "playing", readouts: readouts(null) }}
      >
        <div />
      </FreePlayChrome>,
    );
    expect(dom.getByRole("button", { name: copy.reset.label })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps Recomeçar for every other game", () => {
    render(
      <FreePlayChrome
        game="nonogram"
        pageModifier="page-nonogram"
        state={{
          kind: "playing",
          readouts: { ...readouts(noop), onUndo: null },
        }}
      >
        <div />
      </FreePlayChrome>,
    );
    expect(
      dom.getByRole("button", { name: messages.play.reset.label }),
    ).toBeInTheDocument();
  });

  it("is closed to the daily chrome", () => {
    const probe = () => (
      <DailyPlayChrome
        // @ts-expect-error the daily chrome serves the daily games only
        game="minesweeper"
        pageModifier=""
        date="2026-08-18"
        clock="none"
        extraStat={null}
        state={{ kind: "skeleton" }}
      >
        <div />
      </DailyPlayChrome>
    );
    expect(probe).toBeTypeOf("function");
  });
});
