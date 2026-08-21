import { sessions, sql, users } from "@miolos/db";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { NextRequest } from "next/server";
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

import { OPTIONS, POST } from "../app/telemetry/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import {
  POSTHOG_INGESTION_URL,
  telemetrySettled,
} from "../src/telemetry/capture";

/**
 * POST /telemetry — the first-party relay (#33, ADR-0069 decision 2): the
 * one client-originated event, `puzzle_started`, Zod-parsed against the
 * closed relay contract, keyed by the session's userId, with `archive`
 * derived server-side against the DB clock's SP today. Seam 4 over PGlite;
 * captures observed at the stubbed global fetch; `telemetrySettled()`
 * awaited (direct handler calls take `runAfterResponse`'s fallback arm).
 */
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

let fetchMock: ReturnType<typeof vi.fn>;

const WEB = "https://miolos.app";

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  vi.stubEnv("WEB_ORIGIN", WEB);
  vi.stubEnv("POSTHOG_KEY", "phc_test_key");
  fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

async function createSession(): Promise<{ token: string; userId: string }> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  const token = generateSessionToken();
  await ctx.db
    .insert(sessions)
    .values({ tokenHash: await hashSessionToken(token), userId: user.id });
  return { token, userId: user.id };
}

function relayRequest(init: {
  body?: string;
  token?: string;
  contentType?: string | null;
  secFetchSite?: string;
  origin?: string;
}): NextRequest {
  const headers = new Headers();
  const contentType =
    init.contentType === undefined ? "application/json" : init.contentType;
  if (contentType !== null) {
    headers.set("content-type", contentType);
  }
  if (init.token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${init.token}`);
  }
  if (init.secFetchSite !== undefined) {
    headers.set("sec-fetch-site", init.secFetchSite);
  }
  if (init.origin !== undefined) {
    headers.set("origin", init.origin);
  }
  return new NextRequest("http://localhost:3001/telemetry", {
    method: "POST",
    headers,
    body: init.body,
  });
}

function startedBody(game: string, date: string): string {
  return JSON.stringify({
    event: "puzzle_started",
    properties: { game, date },
  });
}

function capturedEvents(): {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
}[] {
  return fetchMock.mock.calls.map((call) => {
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe(POSTHOG_INGESTION_URL);
    return JSON.parse(init.body as string) as {
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    };
  });
}

describe("POST /telemetry — the first-party relay (#33, ADR-0069)", () => {
  it("T-API-S158: no session is a 204 DROP — empty body, the CORS grant, no error surface for blockers and bots, nothing captured", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const response = await POST(
      relayRequest({ body: startedBody("binairo", today) }),
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
    await telemetrySettled();
    expect(capturedEvents()).toHaveLength(0);
  });

  it("T-API-S159: the boundary — 403 cross-site, 415 non-JSON, 400 malformed and off-contract bodies; nothing captured on any refusal", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token } = await createSession();

    const crossSite = await POST(
      relayRequest({
        body: startedBody("binairo", today),
        token,
        secFetchSite: "cross-site",
      }),
    );
    expect(crossSite.status).toBe(403);

    const wrongType = await POST(
      relayRequest({
        body: startedBody("binairo", today),
        token,
        contentType: "text/plain",
      }),
    );
    expect(wrongType.status).toBe(415);

    const rejected: readonly string[] = [
      "not json",
      // A server-seam event through the relay is refused, not relayed.
      JSON.stringify({
        event: "puzzle_completed",
        properties: { game: "binairo", date: today },
      }),
      // The client may not assert `archive`.
      JSON.stringify({
        event: "puzzle_started",
        properties: { game: "binairo", date: today, archive: true },
      }),
      // Not a calendar date; not a game.
      startedBody("binairo", "2026-02-30"),
      startedBody("chess", today),
    ];
    for (const body of rejected) {
      const response = await POST(relayRequest({ body, token }));
      expect(response.status, body).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid-body" });
    }

    await telemetrySettled();
    expect(capturedEvents()).toHaveLength(0);
  });

  it("T-API-S160: `archive` is DERIVED against the DB clock's SP today — false for today's date, true for a past one", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token } = await createSession();

    await POST(relayRequest({ body: startedBody("sudoku", today), token }));
    await POST(
      relayRequest({
        body: startedBody("sudoku", addDays(today, -3)),
        token,
      }),
    );
    await telemetrySettled();

    const events = capturedEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.properties["archive"]).toBe(false);
    expect(events[1]?.properties["archive"]).toBe(true);
    expect(events[1]?.properties["date"]).toBe(addDays(today, -3));
  });

  it("T-API-S161: the happy path — 204, and the capture carries the resolved userId and the full puzzle_started payload; OPTIONS answers the preflight", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    const response = await POST(
      relayRequest({ body: startedBody("nonogram", today), token }),
    );
    expect(response.status).toBe(204);
    await telemetrySettled();

    const events = capturedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      api_key: "phc_test_key",
      event: "puzzle_started",
      distinct_id: userId,
      properties: {
        game: "nonogram",
        date: today,
        archive: false,
        $process_person_profile: false,
      },
    });

    // The relay POST carries a JSON content type, so cross-origin calls
    // always preflight — OPTIONS must grant it.
    const preflight = OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
  });
});
