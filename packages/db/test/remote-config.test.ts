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

import { getRemoteConfig, setRemoteConfigValue } from "../src/remote-config";
import { remoteConfig } from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();

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
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
      termoAcceptsProfanity: false,
    });
  });

  it("a bufferDepth row overrides the default", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 3 });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 3,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
      termoAcceptsProfanity: false,
    });
  });

  it("an invalid value falls back to its key's default", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "bufferDepth", value: "not a depth" });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
      termoAcceptsProfanity: false,
    });
  });

  it("an out-of-clamp value (500) falls back to its key's default (Zod max 30)", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "bufferDepth", value: 500 });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
      termoAcceptsProfanity: false,
    });
  });

  it("unknown keys are ignored, not fatal", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "someFutureTunable", value: { nested: true } });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
      termoAcceptsProfanity: false,
    });
  });

  it("T-DB-S131: an invalid row falls back to its own default, the other keys keep their stored values, and it is logged once per key", async () => {
    const error = vi.mocked(console.error);
    error.mockClear();
    await ctx.db.insert(remoteConfig).values([
      { key: "bufferDepth", value: 12 },
      { key: "attachStreakThreshold", value: 0 },
      { key: "pushOptInStreakThreshold", value: 9 },
    ]);

    for (let read = 0; read < 2; read++) {
      expect(await getRemoteConfig(ctx.db)).toEqual({
        bufferDepth: 12,
        attachStreakThreshold: 5,
        pushOptInStreakThreshold: 9,
        freeHintsPerPuzzle: 3,
        termoAcceptsProfanity: false,
      });
    }
    const logged = error.mock.calls.filter((call) =>
      String(call[0]).includes("attachStreakThreshold"),
    );
    expect(logged).toHaveLength(1);
  });
});

describe("setRemoteConfigValue", () => {
  it("T-DB-S130: inserts a missing key, updates a present one, moves updated_at, and the read reflects it", async () => {
    await setRemoteConfigValue(ctx.db, "bufferDepth", 10);
    expect((await getRemoteConfig(ctx.db)).bufferDepth).toBe(10);

    const stale = new Date("2026-01-01T00:00:00.000Z");
    await ctx.db
      .update(remoteConfig)
      .set({ updatedAt: stale })
      .where(sql`key = 'bufferDepth'`);
    await setRemoteConfigValue(ctx.db, "bufferDepth", 4);

    const rows = await ctx.db.select().from(remoteConfig);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(4);
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(stale.getTime());
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 4,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
      termoAcceptsProfanity: false,
    });
  });
});

describe("termoAcceptsProfanity in remote_config (ADR-0154)", () => {
  it("T-DB-S160: a stored boolean round-trips, and a stored 1 falls back to false and is logged once", async () => {
    await setRemoteConfigValue(ctx.db, "termoAcceptsProfanity", true);
    expect((await getRemoteConfig(ctx.db)).termoAcceptsProfanity).toBe(true);
    const rows = await ctx.db.select().from(remoteConfig);
    expect(rows.map((row) => row.value)).toEqual([true]);

    await setRemoteConfigValue(ctx.db, "termoAcceptsProfanity", false);
    expect((await getRemoteConfig(ctx.db)).termoAcceptsProfanity).toBe(false);

    const error = vi.mocked(console.error);
    error.mockClear();
    await ctx.db
      .update(remoteConfig)
      .set({ value: 1 })
      .where(sql`key = 'termoAcceptsProfanity'`);
    for (let read = 0; read < 2; read++) {
      expect(await getRemoteConfig(ctx.db)).toEqual({
        bufferDepth: 7,
        attachStreakThreshold: 5,
        pushOptInStreakThreshold: 3,
        freeHintsPerPuzzle: 3,
        termoAcceptsProfanity: false,
      });
    }
    const logged = error.mock.calls.filter((call) =>
      String(call[0]).includes("termoAcceptsProfanity"),
    );
    expect(logged).toHaveLength(1);
  });
});
