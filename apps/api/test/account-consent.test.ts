import { eq, sessions, sql, users } from "@miolos/db";
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

import * as detachRoute from "../app/account/detach-email/route";
import * as reminderRoute from "../app/account/reminder-consent/route";
import { requireUserId } from "../src/session/service";
import { generateSessionToken, hashSessionToken } from "../src/session/token";
import { jsonHeaders } from "./push-helpers";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

const GRANTED_AT = new Date("2026-08-01T12:00:00.000Z");

async function createSession(
  init: { email?: string; recovery?: boolean; reminder?: boolean } = {},
): Promise<{ token: string; userId: string }> {
  const inserted = await ctx.db
    .insert(users)
    .values(
      init.email === undefined
        ? {}
        : {
            email: init.email,
            emailVerifiedAt: GRANTED_AT,
            recoveryConsentAt: init.recovery === false ? null : GRANTED_AT,
            reminderConsentAt: init.reminder ? GRANTED_AT : null,
          },
    )
    .returning();
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

async function readUser(userId: string) {
  const rows = await ctx.db.select().from(users).where(eq(users.id, userId));
  const row = rows[0];
  if (!row) {
    throw new Error("user row is gone");
  }
  return row;
}

function accountRequest(
  path: "reminder-consent" | "detach-email",
  init: { headers: Headers; body: string },
): NextRequest {
  return new NextRequest(`http://localhost:3001/account/${path}`, {
    method: "POST",
    ...init,
  });
}

function setReminder(token: string, granted: boolean): Promise<Response> {
  return reminderRoute.POST(
    accountRequest("reminder-consent", {
      headers: jsonHeaders(token),
      body: JSON.stringify({ granted }),
    }),
  );
}

function detach(token: string): Promise<Response> {
  return detachRoute.POST(
    accountRequest("detach-email", {
      headers: jsonHeaders(token),
      body: JSON.stringify({ confirm: true }),
    }),
  );
}

describe("the two consent routes share the write preamble (#36, ADR-0082)", () => {
  it("T-API-S204: 403 cross-site, 415 non-JSON, 401 without a session and 400 on a bad body, with the CORS grant and nothing written", async () => {
    const { token, userId } = await createSession({
      email: "ana@example.org",
      reminder: true,
    });
    const routes = [
      {
        path: "reminder-consent",
        route: reminderRoute,
        good: { granted: false },
      },
      { path: "detach-email", route: detachRoute, good: { confirm: true } },
    ] as const;

    for (const { path, route, good } of routes) {
      const cross = jsonHeaders(token);
      cross.set("sec-fetch-site", "cross-site");
      const text = new Headers({ "content-type": "text/plain" });
      text.set("cookie", jsonHeaders(token).get("cookie") ?? "");
      const cases: { headers: Headers; body: string; status: number }[] = [
        { headers: cross, body: JSON.stringify(good), status: 403 },
        { headers: text, body: JSON.stringify(good), status: 415 },
        { headers: jsonHeaders(), body: JSON.stringify(good), status: 401 },
        { headers: jsonHeaders(token), body: "{", status: 400 },
        {
          headers: jsonHeaders(token),
          body: JSON.stringify({ ...good, extra: 1 }),
          status: 400,
        },
      ];
      for (const { headers, body, status } of cases) {
        const response = await route.POST(
          accountRequest(path, { headers, body }),
        );
        expect(response.status, `${path} ${String(status)}`).toBe(status);
        expect(response.headers.get("access-control-allow-origin")).toBe(
          "https://miolos.app",
        );
      }

      expect(Object.keys(route).sort()).toEqual(["OPTIONS", "POST", "dynamic"]);
    }

    const untouched = await readUser(userId);
    expect(untouched.email).toBe("ana@example.org");
    expect(untouched.reminderConsentAt).toEqual(GRANTED_AT);
  });
});

describe("POST /account/reminder-consent (#36, ADR-0082 decision 2)", () => {
  it("T-API-S205: withdrawing nulls the consent and stamps the withdrawal once — a repeat keeps the first instant", async () => {
    const { token, userId } = await createSession({
      email: "ana@example.org",
      reminder: true,
    });

    const withdrawn = await setReminder(token, false);
    expect(withdrawn.status).toBe(200);
    expect(await withdrawn.json()).toEqual({ reminderConsent: false });
    const first = await readUser(userId);
    expect(first.reminderConsentAt).toBeNull();
    expect(first.reminderConsentWithdrawnAt).toBeInstanceOf(Date);
    expect(first.email).toBe("ana@example.org");
    expect(first.recoveryConsentAt).toEqual(GRANTED_AT);
    expect(first.recoveryConsentWithdrawnAt).toBeNull();

    const again = await setReminder(token, false);
    expect(await again.json()).toEqual({ reminderConsent: false });
    const second = await readUser(userId);
    expect(second.reminderConsentWithdrawnAt).toEqual(
      first.reminderConsentWithdrawnAt,
    );

    const never = await createSession({ email: "bia@example.org" });
    await setReminder(never.token, false);
    expect(
      (await readUser(never.userId)).reminderConsentWithdrawnAt,
    ).toBeNull();
  });

  it("T-API-S206: re-granting stamps a fresh consent and clears the withdrawal, a repeat keeps the grant instant, and with no email it is a 409 that writes nothing", async () => {
    const { token, userId } = await createSession({
      email: "ana@example.org",
      reminder: true,
    });
    await setReminder(token, false);

    const granted = await setReminder(token, true);
    expect(granted.status).toBe(200);
    expect(await granted.json()).toEqual({ reminderConsent: true });
    const first = await readUser(userId);
    expect(first.reminderConsentAt).toBeInstanceOf(Date);
    expect(first.reminderConsentAt?.getTime()).toBeGreaterThan(
      GRANTED_AT.getTime(),
    );
    expect(first.reminderConsentWithdrawnAt).toBeNull();

    const again = await setReminder(token, true);
    expect(await again.json()).toEqual({ reminderConsent: true });
    expect((await readUser(userId)).reminderConsentAt).toEqual(
      first.reminderConsentAt,
    );

    const anonymous = await createSession();
    const refused = await setReminder(anonymous.token, true);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "no-email" });
    const untouched = await readUser(anonymous.userId);
    expect(untouched.reminderConsentAt).toBeNull();
    expect(untouched.updatedAt).toEqual(untouched.createdAt);
  });
});

describe("POST /account/detach-email (#36, ADR-0082 decision 3)", () => {
  it("T-API-S207: nulls the email and both consents, stamps a withdrawal only where a consent was set, stamps the attach dismissal and keeps the session; a second detach is a 409", async () => {
    const both = await createSession({
      email: "ana@example.org",
      reminder: true,
    });
    const recoveryOnly = await createSession({ email: "bia@example.org" });

    for (const { token } of [both, recoveryOnly]) {
      const response = await detach(token);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ detached: true });
    }

    const a = await readUser(both.userId);
    expect(a.email).toBeNull();
    expect(a.emailVerifiedAt).toBeNull();
    expect(a.recoveryConsentAt).toBeNull();
    expect(a.reminderConsentAt).toBeNull();
    expect(a.recoveryConsentWithdrawnAt).toBeInstanceOf(Date);
    expect(a.reminderConsentWithdrawnAt).toBeInstanceOf(Date);
    expect(a.attachPromptDismissedAt).toBeInstanceOf(Date);

    const b = await readUser(recoveryOnly.userId);
    expect(b.email).toBeNull();
    expect(b.recoveryConsentWithdrawnAt).toBeInstanceOf(Date);
    expect(b.reminderConsentWithdrawnAt).toBeNull();
    expect(b.attachPromptDismissedAt).toBeInstanceOf(Date);

    expect(await requireUserId(ctx.db, both.token)).toBe(both.userId);
    expect(await ctx.db.select().from(sessions)).toHaveLength(2);

    const again = await detach(both.token);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "no-email" });
    expect((await readUser(both.userId)).recoveryConsentWithdrawnAt).toEqual(
      a.recoveryConsentWithdrawnAt,
    );

    const regrant = await setReminder(both.token, true);
    expect(regrant.status).toBe(409);
  });
});
