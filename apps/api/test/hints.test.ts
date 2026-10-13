import {
  FREE_HINTS_PER_PUZZLE,
  hintAllowanceResponseSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import { remoteConfig } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as route from "../app/hints/route";

const WEB = "https://miolos.app";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table remote_config`);
  vi.stubEnv("WEB_ORIGIN", WEB);
  dbOverride = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
  vi.restoreAllMocks();
});

function expectReadHeaders(response: Response): void {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  expect(response.headers.get("set-cookie")).toBeNull();
}

describe("GET /hints (ADR-0098)", () => {
  it("T-API-S311: answers the default, then the stored value, as a credentialed no-store read that sets no cookie", async () => {
    expect(Object.keys(route).sort()).toEqual(["GET", "dynamic"]);
    expect(route.dynamic).toBe("force-dynamic");

    const fresh = await route.GET();
    expect(fresh.status).toBe(200);
    expect(hintAllowanceResponseSchema.parse(await fresh.json())).toEqual({
      freeHintsPerPuzzle: FREE_HINTS_PER_PUZZLE,
    });
    expectReadHeaders(fresh);

    await ctx.db
      .insert(remoteConfig)
      .values({ key: "freeHintsPerPuzzle", value: 5 });
    const stored = await route.GET();
    expect(stored.status).toBe(200);
    expect(await stored.json()).toEqual({ freeHintsPerPuzzle: 5 });
    expectReadHeaders(stored);
  });

  it("T-API-S312: an invalid stored row answers the default, and a database failure is a 500", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "freeHintsPerPuzzle", value: 10 });
    const invalid = await route.GET();
    expect(invalid.status).toBe(200);
    expect(await invalid.json()).toEqual({
      freeHintsPerPuzzle: FREE_HINTS_PER_PUZZLE,
    });

    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("connection lost");
      },
    });
    const failed = await route.GET();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "internal" });
    expectReadHeaders(failed);
  });
});
