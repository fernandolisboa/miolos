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
    });
  });

  it("a bufferDepth row overrides the default", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 3 });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 3,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
    });
  });

  it("an invalid value falls back to defaults", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "bufferDepth", value: "not a depth" });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
    });
  });

  it("an out-of-clamp value (500) falls back to defaults (Zod max 30)", async () => {
    await ctx.db
      .insert(remoteConfig)
      .values({ key: "bufferDepth", value: 500 });
    expect(await getRemoteConfig(ctx.db)).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
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
    });
  });
});
