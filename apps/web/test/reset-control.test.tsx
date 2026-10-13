import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { ResetControl, ResetPlaceholder } from "../src/play/reset-control";

const copy = messages.play.reset;

function mount(onReset: (() => void) | null = () => undefined) {
  return render(<ResetControl onReset={onReset} />);
}

function open(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: copy.label }));
  return screen.getByRole("group");
}

describe("ResetControl asks before it clears (T-WEB-S499)", () => {
  it("shows one button and takes no focus on mount", () => {
    mount();

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.body).toHaveFocus();
  });

  it("swaps the trigger for the question, Cancelar first and focused", () => {
    const onReset = vi.fn();
    mount(onReset);

    const group = open();

    expect(group).toHaveAccessibleName(copy.question);
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([copy.cancel, copy.label]);
    expect(screen.getByRole("button", { name: copy.cancel })).toHaveFocus();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("Cancelar closes without resetting and hands focus back to the trigger", () => {
    const onReset = vi.fn();
    mount(onReset);
    open();

    fireEvent.click(screen.getByRole("button", { name: copy.cancel }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: copy.label })).toHaveFocus();
  });

  it("Recomeçar resets once, closes and hands focus back to the trigger", () => {
    const onReset = vi.fn();
    mount(onReset);
    const group = open();

    fireEvent.click(within(group).getByRole("button", { name: copy.label }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: copy.label })).toHaveFocus();
  });

  it("keeps a disabled trigger that never asks when there is nothing to reset", () => {
    mount(null);

    const trigger = screen.getByRole("button", { name: copy.label });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("keeps focus on the trigger when the confirmed reset leaves no cell decided", () => {
    let onReset: (() => void) | null = () => {
      onReset = null;
    };
    const { rerender } = render(<ResetControl onReset={onReset} />);
    const group = open();

    fireEvent.click(within(group).getByRole("button", { name: copy.label }));
    rerender(<ResetControl onReset={onReset} />);

    const trigger = screen.getByRole("button", { name: copy.label });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveFocus();
  });

  it("stops asking, without taking focus, if no cell is decided any more while it asks", () => {
    const onReset = vi.fn();
    const { rerender } = mount(onReset);
    open();
    screen.getByRole("button", { name: copy.cancel }).blur();

    rerender(<ResetControl onReset={null} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.body).toHaveFocus();

    rerender(<ResetControl onReset={onReset} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: copy.label })).toBeVisible();
  });

  it("the skeleton placeholder is aria-hidden and holds no button", () => {
    const { container } = render(<ResetPlaceholder />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
