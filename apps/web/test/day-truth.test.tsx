import type { DayResponse } from "@miolos/core";
import { act, renderHook } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withoutComments } from "./ts-source";

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

function payload(overrides: Partial<DayResponse["games"]> = {}): DayResponse {
  return {
    date: DATE,
    games: {
      termo: { status: "pending" },
      sudoku: { status: "pending" },
      nonogram: { status: "pending" },
      binairo: { status: "pending" },
      ...overrides,
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(answer: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(() => Promise.resolve(answer()));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loadStore() {
  return import("../src/day/day-truth");
}

const strict = ({ children }: { readonly children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();

  vi.useRealTimers();
});

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("the day-truth store's refresh discipline (T-WEB-S235)", () => {
  it("fetches ONCE for N subscribers, plain and in StrictMode", async () => {
    for (const wrapper of [undefined, strict]) {
      vi.resetModules();
      const fetchMock = stubFetch(() => jsonResponse(200, payload()));
      const { useDayTruth } = await loadStore();

      const rendered = renderHook(
        () => [useDayTruth(), useDayTruth(), useDayTruth(), useDayTruth()],
        { wrapper },
      );
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      for (const value of rendered.result.current) {
        expect(value).toEqual(payload());
      }
      rendered.unmount();
    }
  });

  it("fetches AGAIN when the listener count goes 0 -> 1 — a remount, not only the session's first mount", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const first = renderHook(() => useDayTruth());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.unmount();

    const second = renderHook(() => useDayTruth());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    second.unmount();
  });

  it("the last unsubscribe drops the listeners and RETAINS the payload", async () => {
    stubFetch(() =>
      jsonResponse(200, payload({ sudoku: { status: "completed" } })),
    );
    const { useDayTruth } = await loadStore();

    const first = renderHook(() => useDayTruth());
    await flush();
    expect(first.result.current).toEqual(
      payload({ sudoku: { status: "completed" } }),
    );
    first.unmount();

    stubFetch(() => new Promise<Response>(() => undefined));
    const second = renderHook(() => useDayTruth());
    expect(second.result.current).toEqual(
      payload({ sudoku: { status: "completed" } }),
    );
    second.unmount();
  });

  it("a refetch that changes nothing keeps the snapshot's identity", async () => {
    stubFetch(() =>
      jsonResponse(200, payload({ termo: { status: "completed" } })),
    );
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    const first = rendered.result.current;
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(rendered.result.current).toBe(first);
    rendered.unmount();
  });

  it("a refetch that changes ONLY a duration IS a change — the comparator reads the whole claim (#141)", async () => {
    let elapsedMs = 512_000;
    stubFetch(() =>
      jsonResponse(
        200,
        payload({ sudoku: { status: "completed", elapsedMs } }),
      ),
    );
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    const first = rendered.result.current;
    expect(first?.games.sudoku.elapsedMs).toBe(512_000);

    elapsedMs = 444_000;
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(rendered.result.current).not.toBe(first);
    expect(rendered.result.current?.games.sudoku.elapsedMs).toBe(444_000);
    rendered.unmount();
  });

  it("a refetch that changes ONLY a hint count IS a change too (#142)", async () => {
    let hintsUsed = 0;
    stubFetch(() =>
      jsonResponse(
        200,
        payload({
          sudoku: { status: "completed", elapsedMs: 512_000, hintsUsed },
        }),
      ),
    );
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    const first = rendered.result.current;
    expect(first?.games.sudoku.hintsUsed).toBe(0);

    hintsUsed = 1;
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(rendered.result.current).not.toBe(first);
    expect(rendered.result.current?.games.sudoku.hintsUsed).toBe(1);
    rendered.unmount();
  });

  it("T-WEB-S328: a refetch that changes ONLY the motif name IS a change — and this one is not hypothetical (#64, ADR-0070)", async () => {
    let motifName: string | undefined = undefined;
    stubFetch(() =>
      jsonResponse(
        200,
        payload({
          nonogram: {
            status: "completed",
            elapsedMs: 512_000,
            hintsUsed: 0,
            ...(motifName === undefined ? {} : { motifName }),
          },
        }),
      ),
    );
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    const first = rendered.result.current;
    expect(first?.games.nonogram.status).toBe("completed");
    expect(first?.games.nonogram.motifName).toBeUndefined();

    motifName = "Âncora";
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(rendered.result.current).not.toBe(first);
    expect(rendered.result.current?.games.nonogram.motifName).toBe("Âncora");
    rendered.unmount();
  });
});

describe("the day-truth store's triggers (T-WEB-S236)", () => {
  it("refetches on visibilitychange -> visible, on focus and on online", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    window.dispatchEvent(new Event("online"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    rendered.unmount();

    window.dispatchEvent(new Event("focus"));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("dedupes every trigger while one fetch is in flight", async () => {
    const fetchMock = stubFetch(() => new Promise<Response>(() => undefined));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it("T-WEB-S246: a REJECTED fetch does not wedge the in-flight guard — the next trigger still fetches", async () => {
    const calls = vi.fn();
    let rejecting = true;
    vi.doMock("../src/day/day-client", () => ({
      fetchDayTruth: () => {
        calls();
        return rejecting
          ? Promise.reject(new TypeError("network"))
          : Promise.resolve(payload({ sudoku: { status: "completed" } }));
      },
    }));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    expect(calls).toHaveBeenCalledTimes(1);
    expect(rendered.result.current).toBeUndefined();

    rejecting = false;
    window.dispatchEvent(new Event("online"));
    await flush();
    expect(calls).toHaveBeenCalledTimes(2);
    expect(rendered.result.current?.games.sudoku.status).toBe("completed");

    rendered.unmount();
    vi.doUnmock("../src/day/day-client");
  });

  it("a hidden document does not refetch on visibilitychange", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    visibility.mockRestore();

    rendered.unmount();
  });
});

describe("the visible-tab poll fires and never stacks (T-WEB-S259)", () => {
  it("refetches every 60 s while at least one listener is subscribed and the document is visible", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    rendered.unmount();
  });

  it("a poll tick never stacks requests on a slow in-flight fetch — the guard every trigger already shares", async () => {
    vi.useFakeTimers();

    const fetchMock = stubFetch(() => new Promise<Response>(() => undefined));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });
});

describe("the poll's off states: hidden, zero listeners, cleanup (T-WEB-S260)", () => {
  it("a 0 -> 1 subscribe while hidden installs no timer — the mount fetch stands alone until re-show", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    const rendered = renderHook(() => useDayTruth());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await advance(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    visibility.mockRestore();
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    rendered.unmount();
  });

  it("does not poll while the document is hidden, and the re-show restart resumes it", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    visibility.mockRestore();
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    rendered.unmount();
  });

  it("the last unsubscribe clears the timer — zero listeners poll nothing", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rendered.unmount();
    await advance(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("referential stability under N consumers (T-WEB-S242)", () => {
  it("hands back the same object at N = 4, 16 and 32, plain and in StrictMode, with no render loop", async () => {
    for (const wrapper of [undefined, strict]) {
      for (const consumers of [4, 16, 32]) {
        vi.resetModules();
        stubFetch(() =>
          jsonResponse(200, payload({ nonogram: { status: "completed" } })),
        );
        const { useDayState } = await import("../src/play/day-state");

        let renders = 0;
        const rendered = renderHook(
          () => {
            renders += 1;
            return Array.from({ length: consumers }, () => useDayState(DATE));
          },
          { wrapper },
        );
        await flush();

        const first = rendered.result.current;

        for (const value of first) {
          expect(value.nonogram.status).toBe("completed");
        }
        const rendersAfterSettle = renders;
        window.dispatchEvent(new Event("focus"));
        await flush();

        rendered.result.current.forEach((value, index) => {
          expect(value).toBe(first[index]);
        });
        expect(renders).toBe(rendersAfterSettle);
        rendered.unmount();
      }
    }
  });
});

describe("the day-truth seam is one function body wide (T-WEB-S244)", () => {
  const WEB_ROOT = join(import.meta.dirname, "..");

  function sourceFiles(directory: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        out.push(...sourceFiles(path));
      } else if (/\.tsx?$/.test(path)) {
        out.push(path);
      }
    }
    return out;
  }

  it("`src/day` is imported by `play/day-state.ts` and by nothing else", () => {
    const files = [
      ...sourceFiles(join(WEB_ROOT, "src")),
      ...sourceFiles(join(WEB_ROOT, "app")),
    ].filter((path) => !path.includes(`${join("src", "day")}${sep}`));

    const importers = files
      .filter((path) =>
        /["'][^"']*\/day\/day-(truth|client)["']/.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map((path) => relative(WEB_ROOT, path).replaceAll("\\", "/"));

    expect(importers).toEqual(["src/play/day-state.ts"]);
  });
});

describe("this file's immunity from the session mint is designed (T-WEB-S347)", () => {
  const source = withoutComments(
    readFileSync(join(import.meta.dirname, "day-truth.test.tsx"), "utf8"),
  );

  it("keeps the resetModules, the dynamic load and the all-2xx stubs that make the counts above stable", () => {
    const beforeEachBody = /beforeEach\(\(\) => \{([\s\S]*?)\n\}\);/.exec(
      source,
    );
    expect(beforeEachBody).not.toBeNull();
    expect(beforeEachBody?.[1] ?? "").toContain("vi.resetModules();");

    expect(source).not.toMatch(/from\s+["'][^"']*\/day\/day-truth["']/);

    const statuses = [...source.matchAll(/jsonResponse\(\s*(\d+)/g)].map(
      (match) => Number(match[1] ?? ""),
    );
    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) {
      expect(status).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(300);
    }
  });
});
