import { sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { getRemoteConfig } from "../src/remote-config";
import { remoteConfig } from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
  // The invalid-value paths warn once per process; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table remote_config`);
});

afterAll(async () => {
  await ctx.close();
  vi.restoreAllMocks();
});

describe("getRemoteConfig", () => {
  it("yields defaults on an empty table (bufferDepth 7) — the cron must run against nothing", async () => {
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
    });
  });

  it("a bufferDepth row overrides the default", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 3 });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 3,
      attachStreakThreshold: 5,
    });
  });

  it("an invalid value falls back to defaults", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "bufferDepth", value: "not a depth" });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
    });
  });

  it("an out-of-clamp value (500) falls back to defaults (Zod max 30)", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "bufferDepth", value: 500 });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
    });
  });

  it("unknown keys are ignored, not fatal", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "someFutureTunable", value: { nested: true } });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
    });
  });
});
