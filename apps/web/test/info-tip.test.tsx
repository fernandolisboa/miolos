import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { messages } from "../src/i18n";
import { InfoTip } from "../src/play/info-tip";
import { bodyOf, decl, stylesheet } from "./css-source";

const TEXT = "No teclado: 1 preenche, 2 marca, 0 apaga.";

function setup() {
  render(
    <>
      <InfoTip text={TEXT} align="center" />
      <button type="button">fora</button>
    </>,
  );
  const button = screen.getByRole("button", { name: messages.play.tipAria });
  const tip = screen.getByText(TEXT);
  return { button, tip };
}

describe("the shared (i) tip opens on tap, hover and focus (T-WEB-S660)", () => {
  it("starts closed and still describes its button", () => {
    const { button, tip } = setup();

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAccessibleDescription(TEXT);
    expect(tip).toHaveAttribute("role", "tooltip");
    expect(tip).not.toBeVisible();
  });

  it("toggles on a tap, and an outside tap closes it", () => {
    const { button, tip } = setup();
    const tap = () => {
      fireEvent.pointerDown(button, { pointerType: "touch" });
      fireEvent.focus(button);
      fireEvent.click(button);
    };

    tap();
    expect(tip).toBeVisible();
    expect(button).toHaveAttribute("aria-expanded", "true");
    tap();
    expect(tip).not.toBeVisible();

    tap();
    fireEvent.pointerDown(screen.getByRole("button", { name: "fora" }));
    expect(tip).not.toBeVisible();
  });

  it("opens on keyboard focus and closes on Escape and blur", () => {
    const { button, tip } = setup();

    fireEvent.focus(button);
    expect(tip).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(tip).not.toBeVisible();

    fireEvent.click(button);
    expect(tip).toBeVisible();
    fireEvent.blur(button);
    expect(tip).not.toBeVisible();
  });

  it("follows a mouse hover, and a mouse click keeps it open", () => {
    const { button, tip } = setup();
    const root = button.parentElement as HTMLElement;

    fireEvent.pointerEnter(root, { pointerType: "mouse" });
    expect(tip).toBeVisible();
    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.focus(button);
    fireEvent.click(button);
    expect(tip).toBeVisible();
    fireEvent.pointerLeave(root, { pointerType: "mouse" });
    expect(tip).not.toBeVisible();

    fireEvent.pointerEnter(root, { pointerType: "touch" });
    expect(tip).not.toBeVisible();
  });
});

describe("the (i) tip never takes the keyboard away from the game (T-WEB-S660)", () => {
  it("keeps focus where it was on a mouse press", () => {
    const { button } = setup();

    expect(fireEvent.mouseDown(button)).toBe(false);
  });

  it("still opens on keyboard focus after a cancelled press", () => {
    const { button, tip } = setup();

    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.pointerCancel(button);
    fireEvent.focus(button);
    expect(tip).toBeVisible();
  });

  it("still opens on keyboard focus after a mouse press dragged off the ring", () => {
    const { button, tip } = setup();
    const root = button.parentElement as HTMLElement;

    fireEvent.pointerEnter(root, { pointerType: "mouse" });
    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.pointerLeave(root, { pointerType: "mouse" });
    fireEvent.focus(button);
    expect(tip).toBeVisible();
  });
});

describe("the input controls sit on the board's axis (T-WEB-S661)", () => {
  const sheets = {
    nonogram: [
      stylesheet("src/nonogram/nonogram-board.module.css"),
      ".brushToggle",
    ],
    binairo: [stylesheet("src/binairo/binairo-screen.module.css"), ".digits"],
  } as const;

  it.each(Object.entries(sheets))(
    "centres the %s controls in the middle of three columns",
    (_, [css, group]) => {
      const controls = bodyOf(css, ".controls");

      expect(decl(controls, "width")).toBe("var(--board-side)");
      expect(decl(controls, "grid-template-columns")).toBe("1fr auto 1fr");
      expect(decl(bodyOf(css, group), "grid-column")).toBe("2");
      expect(decl(bodyOf(css, ".affordance"), "justify-self")).toBe("start");
    },
  );

  it("names the erase key in plain words, never Backspace", () => {
    const tips = [
      messages.games.termo.play.keyboard.affordance,
      messages.games.sudoku.play.keypad.affordance,
    ];

    for (const tip of tips) {
      expect(tip).not.toMatch(/backspace/i);
      expect(tip).toContain("tecla de apagar (⌫)");
    }
  });
});
