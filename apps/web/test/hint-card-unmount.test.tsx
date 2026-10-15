import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayScreenChrome } from "../src/play/screen-chrome";

const chunk = vi.hoisted(() => {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release: () => release() };
});

vi.mock("../src/play/hint-card", async (importOriginal) => {
  await chunk.gate;
  return importOriginal();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the hint card's lazy chunk (T-WEB-S720)", () => {
  it("landing after the screen unmounts and the DOM is gone touches no React state", async () => {
    const rejections: unknown[] = [];
    const record = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", record);

    const { unmount } = render(
      <PlayScreenChrome
        game="sudoku"
        pageModifier="page-mark"
        state={{ kind: "skeleton" }}
        back={{ href: "/", label: "Voltar", ariaLabel: "Voltar" }}
        topDate="15 de outubro"
        note={null}
        clock="none"
        extraStat={null}
      >
        {null}
      </PlayScreenChrome>,
    );
    unmount();

    vi.stubGlobal("window", undefined);
    chunk.release();
    await import("../src/play/hint-card");
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
    process.off("unhandledRejection", record);

    expect(rejections).toEqual([]);
  });
});
