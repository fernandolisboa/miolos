import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMountFetch } from "../src/api/use-mount-fetch";
import { withoutComments } from "./ts-source";

/**
 * The shared mount-fetch hook (#206 cluster 3): seven hooks used to carry
 * the same 28-line body — mint first, tri-state, cancel flag — and now
 * delegate to one owner. The behaviour proof stays where it was
 * (`mount-mint-order.test.tsx`, the push, attach, onboarding, medals and
 * stats suites); this file gates the three things extraction put at risk.
 */

const VALUE = { settled: true };

const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

beforeEach(() => {
  bootstrapMock.ensureSession.mockReset();
  bootstrapMock.ensureSession.mockImplementation(() => Promise.resolve());
});

const webRoot = join(import.meta.dirname, "..");

const DECLARING_MODULE = "src/api/use-mount-fetch.ts";

/** Every TypeScript source the app ships, repo-relative to `apps/web/`. */
function sources(): readonly string[] {
  const found: string[] = [];
  for (const root of ["src", "app"]) {
    for (const entry of readdirSync(join(webRoot, root), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
        found.push(relative(webRoot, join(entry.parentPath, entry.name)));
      }
    }
  }
  expect(found.length).toBeGreaterThan(50);
  return found;
}

function codeOf(sourcePath: string): string {
  return withoutComments(readFileSync(join(webRoot, sourcePath), "utf8"));
}

describe("no caller can make useMountFetch refetch (T-WEB-S353)", () => {
  it("freezes both arguments at mount — inline arrows, an aliased import, and a changing prop all buy exactly one read", async () => {
    // The wall is STRUCTURAL, not a spelling rule. A source scan for bare
    // identifiers was the first attempt and a reviewer broke it twice: a
    // per-render closure bound to a `const` passes such a scan and produced
    // ~17k requests in 300ms, and an aliased import evades it outright.
    // Freezing at mount is what makes every one of those harmless.
    let reads = 0;
    const { useMountFetch: useRead } =
      await import("../src/api/use-mount-fetch");
    const { rerender } = renderHook(
      ({ id }: { id: string }) =>
        useRead(
          () => {
            reads += 1;
            return Promise.resolve(id);
          },
          () => id !== "",
        ),
      { initialProps: { id: "a" } },
    );
    for (let i = 0; i < 20; i += 1) {
      rerender({ id: `a${i}` });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(reads).toBe(1);
  });
});

describe("the mint-first mount fetch has ONE owner (T-WEB-S351)", () => {
  it("`ensureSession` is named in code by exactly six modules — the declarer, the bootstrap island, the two write paths, the day-truth store and this hook", () => {
    const naming = sources().filter((sourcePath) =>
      codeOf(sourcePath).includes("ensureSession"),
    );

    // `day/day-truth.ts` is on this list deliberately and is NOT a candidate
    // for the hook: it is a `useSyncExternalStore` module store whose own
    // in-flight guard and post-mint repair are ADR-0072's decision. An
    // eighth hand-rolled mount fetch, by contrast, reds this line.
    expect([...naming].sort()).toEqual([
      "src/api/use-mount-fetch.ts",
      "src/components/session-bootstrap.tsx",
      "src/day/day-truth.ts",
      "src/play/sync.ts",
      "src/session/bootstrap.ts",
      "src/termo/guess-client.ts",
    ]);
  });
});

describe("one mount, one read — and no call site can make it refetch (T-WEB-S352)", () => {
  it("re-rendering re-runs neither the mint nor the fetch", async () => {
    const fetcher = vi.fn(() => Promise.resolve(VALUE));
    const enabled = () => true;

    const { result, rerender } = renderHook(() =>
      useMountFetch(fetcher, enabled),
    );
    await waitFor(() => {
      expect(result.current).toEqual(VALUE);
    });

    rerender();
    rerender();
    // The settle point, named rather than assumed (#209): a re-run effect
    // calls `ensureSession` synchronously inside `rerender`'s act, and its
    // `fetcher` one microtask later, so the counters are read only after a
    // waitFor has given that tail room to land.
    await waitFor(() => {
      expect(result.current).toEqual(VALUE);
    });
    expect(bootstrapMock.ensureSession).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("every call site passes bare identifiers, so `[fetcher, enabled]` is stable by construction", () => {
    // THE WALL IS HERE AND NOT IN THE DEPS ARRAY. An inline arrow for
    // either argument is a fresh value per render, so the effect re-runs,
    // `setValue` re-renders, and the credentialed GET loops without bound.
    // `react-hooks/exhaustive-deps` fires inside the hook, where the deps
    // are correct, and never at the call site.
    //
    // `[^)]*` cannot see a balanced argument list, and does not need to:
    // every shape this bans — arrow, function expression, call — contains a
    // parenthesis, so an imprecise match errs red, which is the safe way.
    // The optional `<…>` is not decoration: an explicit type argument would
    // otherwise hide a whole call site from this scan, and the path set
    // below is what makes an eighth one red.
    const call = /useMountFetch\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
    const sites = sources()
      .filter((sourcePath) => sourcePath !== DECLARING_MODULE)
      .flatMap((sourcePath) =>
        [...codeOf(sourcePath).matchAll(call)].map((match) => ({
          sourcePath,
          args: (match[1] ?? "")
            .split(",")
            .map((argument) => argument.trim())
            .filter((argument) => argument !== ""),
        })),
      );

    expect(sites.map((site) => site.sourcePath).sort()).toEqual([
      "src/attach/use-attach-state.ts",
      "src/medals/use-medals.ts",
      "src/onboarding/use-onboarding-state.ts",
      "src/push/use-push-state.ts",
      "src/stats/use-stats-calendar.ts",
      "src/stats/use-stats.ts",
      "src/streak/use-streak.ts",
    ]);
    for (const site of sites) {
      for (const argument of site.args) {
        expect.soft(argument, site.sourcePath).toMatch(/^[A-Za-z_$][\w$]*$/);
      }
    }
  });
});

describe("both failure directions settle to the honest `null` (T-WEB-S353)", () => {
  it("a rejecting fetcher and a rejecting mint each land on null, and a failed mint issues no read", async () => {
    const rejecting = vi.fn(() => Promise.reject(new Error("network")));
    const { result } = renderHook(() => useMountFetch(rejecting));
    await waitFor(() => {
      expect(result.current).toBeNull();
    });

    bootstrapMock.ensureSession.mockRejectedValue(new Error("mint"));
    const afterFailedMint = vi.fn(() => Promise.resolve(VALUE));
    const second = renderHook(() => useMountFetch(afterFailedMint));
    await waitFor(() => {
      expect(second.result.current).toBeNull();
    });
    expect(afterFailedMint).not.toHaveBeenCalled();
  });
});
