import type { DayResponse } from "@miolos/core";
import { act, renderHook } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The day-truth store (#83, ADR-0060 decision 5): ONE shared value for N
 * consumers, refreshed on listener count 0 -> 1 and on the three events a
 * player actually generates, with NO interval and no payload cache.
 *
 * The module holds state, so every test re-imports it after
 * `vi.resetModules()` — the store is the unit under test and a leaked
 * payload between cases would make each of these vacuous.
 */

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

/** A fetch mock whose answers are handed out one call at a time. */
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

/**
 * Drain the mount effect's fetch and its two microtask hops. `renderHook`
 * already wraps its own render in `act`; what needs flushing is the promise
 * chain `fetchDayTruth` returns.
 */
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
});

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

      // Four consumers on one render — the hub's own shape is five — and
      // one credentialed GET. In StrictMode the subscribe/unsubscribe/
      // subscribe double effect drives 0 -> 1 twice and the in-flight
      // guard absorbs the second.
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
    // `/sudoku/concluido -> /` drops every subscriber and re-adds five.
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

    // The next mount's fetch never settles: whatever it renders is what the
    // store RETAINED. Clearing on cleanup would demote every cross-device
    // tile to pending for the length of a fetch, on every navigation.
    stubFetch(() => new Promise<Response>(() => undefined));
    const second = renderHook(() => useDayTruth());
    expect(second.result.current).toEqual(
      payload({ sudoku: { status: "completed" } }),
    );
    second.unmount();
  });

  it("installs NO interval", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    stubFetch(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    // ADR-0056 decision 1 governs a `localStorage` poll, not a network one;
    // this store never gains a timer (ADR-0060 decision 5).
    expect(setIntervalSpy).not.toHaveBeenCalled();
    rendered.unmount();
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
    // Widened in place under this describe, no new id (the T-WEB-S100 burn
    // precedent): the complement of the identity case above, and the
    // assertion that keeps `samePayload` honest about the field the claim
    // gained at #141.
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

    elapsedMs = 444_000; // an account merge swapped in the other device's row
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(rendered.result.current).not.toBe(first);
    expect(rendered.result.current?.games.sudoku.elapsedMs).toBe(444_000);
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

    // Free, and it is the offline -> online recovery path the client's
    // fallback promises.
    window.dispatchEvent(new Event("online"));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    rendered.unmount();
    // Cleanup really removed the handlers: a trigger after the last
    // unsubscribe fetches nothing.
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
    // The guard's correctness must be LOCAL. `fetchDayTruth` is total by
    // construction today, so this rejection is unreachable through the real
    // client — which is exactly why the client is STUBBED here: the store
    // must not depend on a sibling module's body for the property that it
    // can ever fetch again. With the reset inside the `.then` instead of the
    // `.finally`, `inFlight` stays `true` for the page's lifetime and the
    // second `expect` below reads 1.
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

    // `online` is the offline -> online recovery path the ADR promises, and
    // it is the one a wedged guard would silently swallow.
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
        // Every consumer sees the same merged value, and it is ONE object
        // per consumer that does not churn: ADR-0056's lesson applied to
        // the new store, at the N and under the two modes T-WEB-S214 uses.
        for (const value of first) {
          expect(value.nonogram.status).toBe("completed");
        }
        const rendersAfterSettle = renders;
        window.dispatchEvent(new Event("focus"));
        await flush();
        // A refetch that changes nothing re-renders nothing, so the objects
        // are identical — the loop `useSyncExternalStore` punishes cannot
        // start.
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
      // The trailing separator matters: `join("src","day")` alone would also
      // exclude a future `src/day-something.ts`, i.e. quietly widen the hole
      // this assertion exists to keep closed. Only the DIRECTORY is excluded.
    ].filter((path) => !path.includes(`${join("src", "day")}${sep}`));

    const importers = files
      .filter((path) =>
        /["'][^"']*\/day\/day-(truth|client)["']/.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map((path) => relative(WEB_ROOT, path).replaceAll("\\", "/"));

    // If a second surface wants the payload it goes through `useDayState`,
    // not around it: one seam means one date gate and one merge, and it is
    // what keeps ADR-0053 decision 9's archive claim true.
    expect(importers).toEqual(["src/play/day-state.ts"]);
  });
});
