import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lazyChunk } from "../src/components/lazy-chunk";
import { messages } from "../src/i18n";
import { GameSettingsButton } from "../src/settings/settings-dialog";

const panel = vi.hoisted(() => {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release: () => release() };
});

vi.mock("../src/settings/game-settings", async (importOriginal) => {
  await panel.gate;
  return importOriginal();
});

function deferred() {
  let resolve = (): void => undefined;
  let reject = (): void => undefined;
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok;
    reject = () => fail(new Error("chunk load failed (test)"));
  });
  return { promise, resolve, reject };
}

const copy = messages.settings.games.dialog;

describe("lazyChunk loads once, retries on a new key, and outlives an unmount (T-WEB-S915)", () => {
  it("reports loaded only after the chunk lands, and starts loaded once it has", async () => {
    const chunk = deferred();
    const useLoaded = lazyChunk(() => chunk.promise);
    const first = renderHook(() => useLoaded());

    expect(first.result.current).toBe(false);
    await act(async () => {
      chunk.resolve();
      await chunk.promise;
    });
    expect(first.result.current).toBe(true);
    expect(renderHook(() => useLoaded()).result.current).toBe(true);
  });

  it("asks again after a failure only when the retry key changes", async () => {
    let attempt = deferred();
    const load = vi.fn(() => attempt.promise);
    const useLoaded = lazyChunk(load);
    const hook = renderHook(({ key }) => useLoaded(key), {
      initialProps: { key: 0 },
    });

    await act(async () => {
      attempt.reject();
      await attempt.promise.catch(() => undefined);
    });
    expect(hook.result.current).toBe(false);
    hook.rerender({ key: 0 });
    expect(load).toHaveBeenCalledTimes(1);

    attempt = deferred();
    hook.rerender({ key: 1 });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      attempt.resolve();
      await attempt.promise;
    });
    expect(hook.result.current).toBe(true);
  });

  it("a chunk landing after unmount still counts for the next mount", async () => {
    const chunk = deferred();
    const useLoaded = lazyChunk(() => chunk.promise);
    const { unmount } = renderHook(() => useLoaded());

    unmount();
    await act(async () => {
      chunk.resolve();
      await chunk.promise;
    });
    expect(renderHook(() => useLoaded()).result.current).toBe(true);
  });
});

describe("the in-game Ajustes dialog opens only once its panel chunk lands (T-WEB-S915)", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
      this.querySelector<HTMLElement>("button")?.focus();
    };
  });

  it("stays shut while the panel is in flight, then opens on its first switch", async () => {
    render(<GameSettingsButton game="sudoku" clock />);
    fireEvent.click(screen.getByRole("button", { name: copy.trigger }));
    await act(async () => {
      await Promise.resolve();
    });

    const dialog = document.querySelector("dialog");
    expect(dialog).not.toHaveAttribute("open");
    expect(dialog?.querySelector('[role="switch"]')).toBeNull();

    await act(async () => {
      panel.release();
      await panel.gate;
    });
    const opened = await screen.findByRole("dialog", { name: copy.title });
    expect(opened).toHaveAttribute("open");
    expect(document.activeElement?.getAttribute("role")).toBe("switch");
  });
});
