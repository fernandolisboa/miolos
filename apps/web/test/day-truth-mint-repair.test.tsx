import type { DayResponse } from "@miolos/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const API_URL = "https://api.example.test";
const DATE = "2026-08-22";

const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

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

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function stubApi(day: () => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (urlOf(input) === `${API_URL}/day`) {
      return Promise.resolve(day());
    }
    return Promise.resolve(jsonResponse(200, {}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return () =>
    fetchMock.mock.calls.filter((call) => urlOf(call[0]) === `${API_URL}/day`)
      .length;
}

async function loadStore() {
  return import("../src/day/day-truth");
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);

  bootstrapMock.ensureSession.mockReset();
  bootstrapMock.ensureSession.mockImplementation(() => Promise.resolve());
});

describe("the day-truth store repairs after the mint (T-WEB-S344)", () => {
  it("fires GET /day immediately, then — and only after the mint resolves — fetches once more, which is how the re-mint load's 401 is repaired", async () => {
    let answer = (): Response => jsonResponse(401, { error: "no-session" });
    const dayCalls = stubApi(() => answer());
    let releaseMint = (): void => undefined;
    bootstrapMock.ensureSession.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseMint = resolve;
      }),
    );
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());

    expect(dayCalls()).toBe(1);
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);
    });

    await flush();
    expect(dayCalls()).toBe(1);
    expect(rendered.result.current).toBeUndefined();

    answer = () =>
      jsonResponse(200, payload({ sudoku: { status: "completed" } }));
    releaseMint();
    await flush();
    expect(dayCalls()).toBe(2);
    expect(rendered.result.current?.games.sudoku.status).toBe("completed");

    rendered.unmount();
  });
});

describe("a healthy load pays nothing for the repair (T-WEB-S345)", () => {
  it("a 200 on the first try fetches /day exactly once and never touches ensureSession — the round trip this ticket exists to KEEP", async () => {
    const dayCalls = stubApi(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();

    expect(dayCalls()).toBe(1);
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();
    expect(rendered.result.current).toEqual(payload());

    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(dayCalls()).toBe(2);
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it("a store that already holds today's truth does not spend the one-shot on a later empty answer — the `payload === undefined` narrowing, not just `next === undefined`", async () => {
    let answer = (): Response => jsonResponse(200, payload());
    const dayCalls = stubApi(() => answer());
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();

    expect(dayCalls()).toBe(1);
    expect(rendered.result.current).toEqual(payload());

    answer = () => jsonResponse(500, { error: "internal" });
    window.dispatchEvent(new Event("focus"));
    await flush();

    expect(dayCalls()).toBe(2);
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();
    expect(rendered.result.current).toEqual(payload());

    rendered.unmount();
  });

  it("the repair JOINS a mint and never starts one — `ensureSession()` is called, but no second `POST /session` is issued", async () => {
    const mint = vi.fn(() => Promise.resolve());
    bootstrapMock.ensureSession.mockImplementation(mint);

    const dayCalls = stubApi(() => jsonResponse(401, { error: "no-session" }));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();

    expect(dayCalls()).toBe(2);

    expect(mint).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });
});

describe("the repair is one per page load, and a hanging mint never wedges the store (T-WEB-S346)", () => {
  it("(a) two consecutive empty answers buy exactly two GET /day and no third", async () => {
    const dayCalls = stubApi(() => jsonResponse(401, { error: "no-session" }));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();

    expect(dayCalls()).toBe(2);
    expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);

    await flush();
    expect(dayCalls()).toBe(2);

    rendered.unmount();
  });

  it("(b) a mint that never settles releases the guard anyway — a later focus still fetches", async () => {
    const dayCalls = stubApi(() => jsonResponse(401, { error: "no-session" }));
    bootstrapMock.ensureSession.mockReturnValue(
      new Promise<void>(() => undefined),
    );
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    expect(dayCalls()).toBe(1);
    expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(dayCalls()).toBe(2);

    window.dispatchEvent(new Event("online"));
    await flush();
    expect(dayCalls()).toBe(3);

    rendered.unmount();
  });

  it("(c) refreshDayTruth() shares the SAME page-scoped one-shot — the two entry points cannot each get a repair", async () => {
    const dayCalls = stubApi(() => jsonResponse(401, { error: "no-session" }));
    const { useDayTruth, refreshDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();

    expect(dayCalls()).toBe(2);

    refreshDayTruth();
    await flush();

    expect(dayCalls()).toBe(3);
    expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });
});
