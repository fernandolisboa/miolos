import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TermoFreeScreen } from "../src/free-play/termo-free-screen";
import { messages } from "../src/i18n";
import { flushGeneration } from "./free-generation";

const chunk = vi.hoisted(() => ({ asks: 0, failNext: true }));

vi.mock("../src/free-play/termo-variants", async (importOriginal) => {
  chunk.asks += 1;
  if (chunk.failNext) {
    chunk.failNext = false;
    throw new Error("chunk load failed (test)");
  }
  return importOriginal();
});

const copy = messages.freePlay.variant;

async function settle(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < 10; tick += 1) {
      await Promise.resolve();
    }
  });
}

beforeEach(() => {
  HTMLElement.prototype.hidePopover = vi.fn();
});

describe("the variant chunk preloads on mount and the trigger retries it (T-WEB-S898)", () => {
  it("leaves Clássico playable while the chunk fails, and a tap on the trigger loads it again", async () => {
    render(<TermoFreeScreen deps={{ pickSeed: () => 20_261_015 }} />);
    await flushGeneration();
    await settle();

    expect(chunk.asks).toBe(1);
    const trigger = screen.getByRole("button", {
      name: copy.triggerAria(copy.classico),
    });
    expect(trigger).not.toHaveAttribute("popovertarget");
    expect(screen.queryByRole("radio", { hidden: true })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /^letra \d de 5/ }),
    ).toHaveLength(5);

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("popovertarget");
    });

    expect(chunk.asks).toBe(2);
    expect(screen.getAllByRole("radio", { hidden: true })).toHaveLength(3);

    fireEvent.click(
      screen.getByRole("radio", {
        name: copy.aria(copy.quarteto),
        hidden: true,
      }),
    );
    await flushGeneration();

    expect(document.querySelector('[data-play-state="skeleton"]')).toBeNull();
    expect(
      screen.getByRole("group", { name: copy.boardAria(4, 4) }),
    ).toBeInTheDocument();
  });
});
