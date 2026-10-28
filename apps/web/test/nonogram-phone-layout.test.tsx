import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { choice } from "../src/free-play/choice";
import { ChoiceToggle } from "../src/free-play/choice-picker";
import { bodyOf, decl, stylesheet } from "./css-source";

const GAME_CSS = stylesheet("src/nonogram/nonogram-board.module.css");
const SHARED_CSS = stylesheet("src/play/screen.module.css");
const FREE_CSS = stylesheet("src/free-play/free-play.module.css");

describe("on a phone the Nonogram board takes the column's width (T-WEB-S1105)", () => {
  it("floors the well at the column width, capped by the size's ceiling, only up to 480px", () => {
    const phone = bodyOf(GAME_CSS, "@media (max-width: 480px)");
    expect(decl(bodyOf(phone, ".pageNonogram"), "--board-min")).toBe(
      "min(100vw - 2 * var(--space-4), var(--board-max))",
    );
    expect(
      decl(
        bodyOf(bodyOf(GAME_CSS, "@media (max-width: 768px)"), ".pageNonogram"),
        "--board-min",
      ),
    ).toBeUndefined();
  });

  it("mirrors the gutter `.page` keeps on a phone", () => {
    const padding = decl(
      bodyOf(bodyOf(SHARED_CSS, "@media (max-width: 768px)"), ".page"),
      "padding",
    );
    expect(padding?.split(/\s+/)[1]).toBe("var(--space-4)");
  });
});

describe("the frame stays 3px and the inner group rules are thinner (T-WEB-S1106)", () => {
  it("draws the inner rules at 2.5px and every frame edge at 3px", () => {
    expect(decl(bodyOf(GAME_CSS, ".cellRuleTop"), "border-top-width")).toBe(
      "2.5px",
    );
    for (const [edge, side] of [
      ["Top", "top"],
      ["Left", "left"],
      ["Right", "right"],
      ["Bottom", "bottom"],
    ] as const) {
      expect(decl(bodyOf(GAME_CSS, `.cellEdge${edge}`), `border-${side}`)).toBe(
        "3px solid var(--ink)",
      );
    }
  });
});

function variant(selected: string, onSelect = vi.fn()) {
  return {
    ...choice({
      label: "Variante",
      options: ["classico", "cores"],
      selected,
      optionLabel: (option) => (option === "cores" ? "Cores" : "Clássico"),
      optionAria: (option) => `Variante: ${option}`,
      onSelect,
    }),
    toggle: { on: "cores", off: "classico", icon: null },
  };
}

describe("the Cores variant is one toggle button (T-WEB-S1107)", () => {
  it("is pressed on Cores, and a press flips to the other variant", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <ChoiceToggle {...variant("classico", onSelect)} />,
    );
    const button = screen.getByRole("button", { name: "Variante: cores" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(onSelect).toHaveBeenLastCalledWith("cores");

    rerender(<ChoiceToggle {...variant("cores", onSelect)} />);
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onSelect).toHaveBeenLastCalledWith("classico");
  });

  it("takes focus back on its next mount only when it held focus as it unmounted", () => {
    const first = render(<ChoiceToggle {...variant("classico")} />);
    screen.getByRole("button").focus();
    first.unmount();

    const second = render(<ChoiceToggle {...variant("cores")} />);
    expect(document.activeElement).toBe(screen.getByRole("button"));
    (document.activeElement as HTMLElement).blur();
    second.unmount();

    render(<ChoiceToggle {...variant("cores")} />);
    expect(document.activeElement).toBe(document.body);
  });
});

describe("the toggle looks like an idle chip until pressed (T-WEB-S1108)", () => {
  it("matches the idle chip's surface off, and sinks with an ink border on", () => {
    const toggle = bodyOf(FREE_CSS, ".choiceToggle");
    const chip = bodyOf(FREE_CSS, ".choiceChip");
    for (const property of ["background", "border", "border-radius"]) {
      expect(decl(toggle, property)).toBe(decl(chip, property));
    }
    expect(decl(toggle, "box-shadow")).toBeUndefined();

    const pressed = bodyOf(FREE_CSS, '.choiceToggle[aria-pressed="true"]');
    expect(decl(pressed, "border")).toBe("1.5px solid var(--ink)");
    expect(decl(pressed, "box-shadow")).toMatch(/^inset /);
    expect(decl(pressed, "transform")).toBe("translate(1px, 1px)");
  });

  it("outlines the icon's cells in ink and keeps the pressed state in forced colours", () => {
    expect(decl(bodyOf(FREE_CSS, ".toggleIcon"), "stroke")).toBe("var(--ink)");
    const forced = bodyOf(FREE_CSS, "@media (forced-colors: active)");
    expect(
      decl(
        bodyOf(forced, '.choiceToggle[aria-pressed="true"]'),
        "border-width",
      ),
    ).toBe("3px");
  });
});
