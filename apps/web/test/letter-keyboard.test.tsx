import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  LetterKeyboard,
  type LetterKeyboardRow,
} from "../src/play/letter-keyboard";

function rows(onActivate: (id: string) => void): readonly LetterKeyboardRow[] {
  return [
    {
      keys: [
        {
          id: "q",
          column: 1,
          span: 2,
          label: "q",
          ariaLabel: "letra q",
          className: "key",
          onActivate: () => {
            onActivate("q");
          },
        },
        {
          id: "w",
          column: 3,
          span: 2,
          label: "w",
          ariaLabel: "letra w",
          className: "key",
          onActivate: () => {
            onActivate("w");
          },
        },
      ],
    },
    {
      keys: [
        {
          id: "enter",
          column: 1,
          span: 3,
          label: "ok",
          ariaLabel: "confirmar",
          className: "key command",
          onActivate: () => {
            onActivate("enter");
          },
        },
        {
          id: "a",
          column: 4,
          span: 2,
          label: "a",
          ariaLabel: "letra a",
          className: "key",
          onActivate: () => {
            onActivate("a");
          },
        },
      ],
    },
  ];
}

function renderKeyboard(onActivate: (id: string) => void = () => undefined) {
  return render(
    <LetterKeyboard
      rows={rows(onActivate)}
      groupClassName="keyboard"
      groupLabel="teclado"
    />,
  );
}

describe("LetterKeyboard is a labelled, one-tab-stop composite widget (T-WEB-S433)", () => {
  it("is a role=group with the given label, seeded on the first key", () => {
    renderKeyboard();
    const group = screen.getByRole("group", { name: "teclado" });
    const keys = within(group).getAllByRole("button");
    expect(keys).toHaveLength(4);
    expect(keys.filter((key) => key.getAttribute("tabindex") === "0")).toEqual([
      screen.getByRole("button", { name: "letra q" }),
    ]);
  });

  it("places each key at its given grid column and span", () => {
    renderKeyboard();
    const enter = screen.getByRole("button", { name: "confirmar" });
    expect(enter.style.gridColumn).toBe("1 / span 3");
  });

  it("moves the roving caret with the arrows, clamped at row edges, wired to Home/End too", () => {
    renderKeyboard();
    const q = screen.getByRole("button", { name: "letra q" });
    q.focus();

    fireEvent.keyDown(q, { key: "ArrowRight" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "letra w" }),
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "ArrowRight",
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "letra w" }),
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "ArrowDown",
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "letra a" }),
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "letra a" }),
    );

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "confirmar" }),
    );
  });

  it("calls onActivate exactly once per click, whichever key it is", () => {
    const onActivate = vi.fn();
    renderKeyboard(onActivate);
    fireEvent.click(screen.getByRole("button", { name: "letra a" }), {
      detail: 1,
    });
    expect(onActivate).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("blurs a POINTER activation and keeps a KEYBOARD one", () => {
    renderKeyboard();
    const w = screen.getByRole("button", { name: "letra w" });
    w.focus();
    fireEvent.click(w, { detail: 1 });
    expect(document.activeElement).not.toBe(w);

    w.focus();
    fireEvent.click(w, { detail: 0 });
    expect(document.activeElement).toBe(w);
  });

  it("hands the focused node to activeKeyRef", () => {
    const ref = createRef<HTMLButtonElement | null>();
    render(
      <LetterKeyboard
        rows={rows(() => undefined)}
        groupClassName="keyboard"
        groupLabel="teclado"
        activeKeyRef={ref}
      />,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "letra q" }));
  });
});
