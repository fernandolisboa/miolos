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

describe("lazyChunk reports loading, ready or failed, retries on a new key or mount, and outlives an unmount (T-WEB-S915)", () => {
  it("is loading until the chunk lands, then ready with its value, and starts ready once it has", async () => {
    const chunk = deferred();
    const useChunk = lazyChunk(() => chunk.promise.then(() => "panel"));
    const first = renderHook(() => useChunk());

    expect(first.result.current).toEqual({ state: "loading" });
    await act(async () => {
      chunk.resolve();
      await chunk.promise;
    });
    expect(first.result.current).toEqual({ state: "ready", value: "panel" });
    expect(renderHook(() => useChunk()).result.current).toEqual({
      state: "ready",
      value: "panel",
    });
  });

  it("fails, stays failed under the same key, and loads again under a new one", async () => {
    let attempt = deferred();
    const load = vi.fn(() => attempt.promise);
    const useChunk = lazyChunk(load);
    const hook = renderHook(({ key }) => useChunk(key), {
      initialProps: { key: 0 },
    });

    await act(async () => {
      attempt.reject();
      await attempt.promise.catch(() => undefined);
    });
    expect(hook.result.current.state).toBe("failed");
    hook.rerender({ key: 0 });
    expect(hook.result.current.state).toBe("failed");
    expect(load).toHaveBeenCalledTimes(1);

    attempt = deferred();
    hook.rerender({ key: 1 });
    expect(hook.result.current.state).toBe("loading");
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      attempt.resolve();
      await attempt.promise;
    });
    expect(hook.result.current.state).toBe("ready");
  });

  it("loads again when a failed hook mounts anew", async () => {
    let attempt = deferred();
    const load = vi.fn(() => attempt.promise);
    const useChunk = lazyChunk(load);
    const first = renderHook(() => useChunk());
    await act(async () => {
      attempt.reject();
      await attempt.promise.catch(() => undefined);
    });
    expect(first.result.current.state).toBe("failed");
    first.unmount();

    attempt = deferred();
    const second = renderHook(() => useChunk());
    expect(second.result.current.state).toBe("loading");
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      attempt.resolve();
      await attempt.promise;
    });
    expect(second.result.current.state).toBe("ready");
  });

  it("a chunk landing after unmount still counts for the next mount", async () => {
    const chunk = deferred();
    const useChunk = lazyChunk(() => chunk.promise);
    const { unmount } = renderHook(() => useChunk());

    unmount();
    await act(async () => {
      chunk.resolve();
      await chunk.promise;
    });
    expect(renderHook(() => useChunk()).result.current.state).toBe("ready");
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
