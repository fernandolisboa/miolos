import type { DayResponse } from "@miolos/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The day-truth store's POST-MINT REPAIR (#195, ADR-0072).
 *
 * The store is the eighth reader of the authenticated surface and the only
 * one that is NOT mint-ordered. `refresh()` fires immediately — a warm load
 * must not pay a round trip on the read that decides whether a hub tile is a
 * call to action or a `Feito` — and when a fetch answers `undefined` while
 * the store has never held a server truth on this page load, it spends a
 * PAGE-LIFETIME ONE-SHOT: `ensureSession()`, then one more `refresh()`,
 * scheduled after the in-flight guard has already been released.
 *
 * WHY NOT `await ensureSession()` INSIDE `refresh()`, the shape #149 gave the
 * seven hooks: `ensureSession()` has no timeout, so holding `inFlight` across
 * it would leave the guard set for the lifetime of the page on a hanging
 * mint, with no rejection for `finally` to release — the exact wedge
 * `day-truth.ts`'s longest comment exists to prevent. `T-WEB-S346`(b) is that
 * property, asserted.
 *
 * A NEW FILE RATHER THAN A NEW `describe` IN `day-truth.test.tsx`: `vi.mock`
 * is hoisted file-wide, so mocking the mint there would put a mocked
 * `ensureSession` into all of that file's cases and change its character.
 * `day-truth.test.tsx`'s own designed immunity from the mint is asserted
 * there, by `T-WEB-S347`.
 *
 * THE ORDERING IDIOM IS `assertAwaitsTheMint` in `mount-mint-order.test.tsx`
 * (#149), cited rather than reused: that helper is shaped for hooks
 * (`useHook`, `read`, `settled`) and a module store has no per-consumer
 * cancelled flag and no single `read` mock. What is copied is the shape —
 * hold the mint unresolved, assert the ordered read has NOT been issued, then
 * release and assert it has.
 */

const API_URL = "https://api.example.test";
const DATE = "2026-08-22";

// `ensureSession` is stubbed by SPREADING the real module (napkin § Domain 7's
// prescribed remedy, the `mount-mint-order.test.tsx` discipline): everything
// else `bootstrap.ts` exports stays real, and only the mint is driven.
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

/**
 * Routes `/day`; anything else answers 200 with an empty body. EVERY COUNT IN
 * THIS FILE IS URL-FILTERED (`nonogram-motif-name.test.tsx`'s `dayCalls()`
 * idiom), because a `POST /session` is in play here by design — an unfiltered
 * `toHaveBeenCalledTimes` would be counting two endpoints as one.
 */
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

/** Drain the store's fetch chain and its microtask hops. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  // The store holds module state — `mintRepairSpent` above all — so every
  // case re-imports it. Without this the one-shot would be spent by the first
  // case and every later one would be vacuous.
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  // `vi.mock` is hoisted and SURVIVES `resetModules`; the per-case
  // implementation does not, so it is re-applied here rather than assumed.
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
    // (i) THE WARM PATH WAS NOT MADE TO WAIT. The mount fetch is already out
    // before anything has touched the mint — this is the half that a
    // `await ensureSession()` inside `refresh()` would delete.
    expect(dayCalls()).toBe(1);
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();

    // The 401 lands: the store asks for the identity.
    await waitFor(() => {
      expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);
    });

    // (ii) THE REPAIR AWAITS THE MINT. No second `GET /day` while the mint is
    // unresolved — the `assertAwaitsTheMint` half, and the assertion that
    // kills a `Promise.all([ensureSession(), fetchDayTruth()])` repair.
    await flush();
    expect(dayCalls()).toBe(1);
    expect(rendered.result.current).toBeUndefined();

    // (iii) Released, the repaired read lands and the payload appears.
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
    // The (e)-analogue of `T-WEB-S340`. A future developer "simplifying"
    // `refresh()` to `await ensureSession()` before the fetch — mirroring the
    // seven hooks #149 ordered — reds this, and that is the whole point of
    // the id: the hub's day read is deliberately the one that is not ordered,
    // because ordering it costs a round trip on EVERY warm load on the read
    // that decides a tile's shape.
    const dayCalls = stubApi(() => jsonResponse(200, payload()));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();

    expect(dayCalls()).toBe(1);
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();
    expect(rendered.result.current).toEqual(payload());

    // And a later trigger on a store that HOLDS a truth still asks for
    // nothing: the repair is armed by "no truth at all", never by a refetch.
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(dayCalls()).toBe(2);
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();

    rendered.unmount();
  });
});

describe("the repair is one per page load, and a hanging mint never wedges the store (T-WEB-S346)", () => {
  it("(a) two consecutive empty answers buy exactly two GET /day and no third", async () => {
    // The one-shot's bound. Without it the repair's own empty answer arms
    // another repair, and the store retries `/day` against a failing API for
    // as long as the page is open.
    const dayCalls = stubApi(() => jsonResponse(401, { error: "no-session" }));
    const { useDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();

    expect(dayCalls()).toBe(2);
    expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);

    // Draining again changes nothing: the flag is set BEFORE the mint is
    // awaited and is never cleared, so the chain is bounded at length two.
    await flush();
    expect(dayCalls()).toBe(2);

    rendered.unmount();
  });

  it("(b) a mint that never settles releases the guard anyway — a later focus still fetches", async () => {
    // The property that DISQUALIFIED the ordering candidates rather than
    // merely costing them. `ensureSession()` has no timeout: awaiting it under
    // `inFlight` would leave the guard set for the page's lifetime with
    // nothing for `finally` to release, and every later trigger — `online`
    // recovery included — would be swallowed. Here the guard is released
    // first, in the same synchronous `finally` body, so the mint can hang
    // forever and the store keeps working.
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
    // `refreshDayTruth()` is the conclusion's nudge (#64, ADR-0070) and is a
    // bare delegation to `refresh()`, so it reaches the repair arm through the
    // same flag. Two flags would make this four calls; one makes it three.
    // This is the case `T-WEB-S348` was reserved for; it is folded here and
    // burned, because no mutation reddens one of the two and spares the other.
    const dayCalls = stubApi(() => jsonResponse(401, { error: "no-session" }));
    const { useDayTruth, refreshDayTruth } = await loadStore();

    const rendered = renderHook(() => useDayTruth());
    await flush();
    // The mount fetch plus its one repair.
    expect(dayCalls()).toBe(2);

    refreshDayTruth();
    await flush();
    // The nudge fetched, answered empty, and bought NO second repair.
    expect(dayCalls()).toBe(3);
    expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });
});
