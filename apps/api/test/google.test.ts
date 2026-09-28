import { sessions, sql, users } from "@miolos/db";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
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

import { GET as googleStateGet } from "../app/account/google/route";
import { POST as confirmPost } from "../app/attach/confirm/route";
import { POST as attachRequestPost } from "../app/attach/request/route";
import { POST as unlinkPost } from "../app/account/unlink-google/route";
import { GET as callbackGet } from "../app/auth/google/callback/route";
import { GET as startGet } from "../app/auth/google/start/route";
import {
  buildFlowCookie,
  FLOW_COOKIE_NAME,
  googleSubject,
  readFlowCookie,
  startFlow,
  type Flow,
} from "../src/google/oauth";
import { attachEmailToUser, mintAttachToken } from "../src/attach/service";
import { resolveGoogleSignIn } from "../src/google/service";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { createSessionForUser, requireUserId } from "../src/session/service";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

const WEB = "https://miolos.app";
const API = "https://api.miolos.app";
const CLIENT_ID = "client-id.apps.googleusercontent.com";
const NOW = 1_800_000_000;

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

const mergeHook = vi.hoisted(() => ({
  before: undefined as (() => Promise<void>) | undefined,
  after: undefined as (() => Promise<void>) | undefined,
}));
vi.mock("@miolos/db/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/db/user")>();
  const mergeAccounts: typeof actual.mergeAccounts = async (...args) => {
    await mergeHook.before?.();
    const merged = await actual.mergeAccounts(...args);
    await mergeHook.after?.();
    return merged;
  };
  return { ...actual, mergeAccounts };
});

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
  vi.stubEnv("WEB_ORIGIN", WEB);
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("COOKIE_DOMAIN", "");
});

afterEach(() => {
  mergeHook.before = undefined;
  mergeHook.after = undefined;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await ctx.close();
});

function part(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function idToken(claims: Record<string, unknown>): string {
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

function claimsFor(sub: string): Record<string, unknown> {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 300,
    sub,
  };
}

function stubTokenEndpoint(answer: () => Response) {
  const fetchStub = vi.fn<
    (url: string, init: { body: URLSearchParams }) => Promise<Response>
  >(() => Promise.resolve(answer()));
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

async function createUser(
  init: { createdAt?: Date; email?: string; googleId?: string } = {},
): Promise<{ userId: string; token: string }> {
  const inserted = await ctx.db
    .insert(users)
    .values({
      ...(init.createdAt ? { createdAt: init.createdAt } : {}),
      ...(init.email ? { email: init.email, emailVerifiedAt: sql`now()` } : {}),
      ...(init.googleId ? { googleId: init.googleId } : {}),
    })
    .returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  const token = generateSessionToken();
  await ctx.db
    .insert(sessions)
    .values({ tokenHash: await hashSessionToken(token), userId: user.id });
  return { userId: user.id, token };
}

async function addSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  await ctx.db
    .insert(sessions)
    .values({ tokenHash: await hashSessionToken(token), userId });
  return token;
}

async function googleIdOf(userId: string): Promise<string | null> {
  const rows = await ctx.db
    .select({ googleId: users.googleId })
    .from(users)
    .where(sql`id = ${userId}`);
  return rows[0]?.googleId ?? null;
}

async function insertWin(userId: string): Promise<void> {
  await ctx.db.insert(completions).values({
    userId,
    game: "sudoku",
    date: "2026-08-01",
    completedAt: new Date("2026-08-01T15:00:00Z"),
    outcome: "won",
    elapsedMs: 1000,
    hintsUsed: 0,
    onTime: true,
  });
}

async function completionOwners(): Promise<{ userId: string }[]> {
  return await ctx.db.select({ userId: completions.userId }).from(completions);
}

function flowCookieValue(flow: Flow): string {
  return buildFlowCookie(flow).split(";")[0]?.split("=")[1] ?? "";
}

function callbackRequest(init: {
  flow?: Flow;
  session?: string;
  query: Record<string, string>;
}): NextRequest {
  const cookies: string[] = [];
  if (init.flow) {
    cookies.push(`${FLOW_COOKIE_NAME}=${flowCookieValue(init.flow)}`);
  }
  if (init.session) {
    cookies.push(`${SESSION_COOKIE_NAME}=${init.session}`);
  }
  const url = new URL("/auth/google/callback", API);
  url.search = new URLSearchParams(init.query).toString();
  return new NextRequest(url, {
    headers: cookies.length ? { cookie: cookies.join("; ") } : {},
  });
}

async function signIn(init: {
  sub: string;
  session?: string;
}): Promise<Response> {
  const flow = startFlow();
  stubTokenEndpoint(() =>
    Response.json({ id_token: idToken(claimsFor(init.sub)) }),
  );
  return await callbackGet(
    callbackRequest({
      flow,
      ...(init.session ? { session: init.session } : {}),
      query: { code: "auth-code", state: flow.state },
    }),
  );
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function sessionTokenOf(response: Response): string | undefined {
  const cookie = setCookies(response).find((c) =>
    c.startsWith(`${SESSION_COOKIE_NAME}=`),
  );
  return cookie?.split(";")[0]?.split("=")[1];
}

describe("the Google ID token and flow cookie (ADR-0089)", () => {
  it("T-API-S260: googleSubject returns sub only for our audience, Google's issuer and an unexpired token", () => {
    const good = {
      iss: "https://accounts.google.com",
      aud: CLIENT_ID,
      exp: NOW + 60,
      sub: "108234567890",
    };
    const expected = { clientId: CLIENT_ID, nowSeconds: NOW };
    expect(googleSubject(idToken(good), expected)).toBe("108234567890");
    expect(
      googleSubject(idToken({ ...good, iss: "accounts.google.com" }), expected),
    ).toBe("108234567890");

    for (const bad of [
      { ...good, aud: "someone-else" },
      { ...good, iss: "https://evil.example" },
      { ...good, exp: NOW },
      { ...good, sub: "" },
      { ...good, sub: undefined },
    ]) {
      expect(googleSubject(idToken(bad), expected), JSON.stringify(bad)).toBe(
        undefined,
      );
    }
    for (const malformed of ["", "a", "a.!!!.c", `a.${part("x")}.c`]) {
      expect(googleSubject(malformed, expected)).toBeUndefined();
    }
  });

  it("T-API-S261: the flow cookie round-trips and anything else reads as no flow", () => {
    const flow = startFlow();
    expect(readFlowCookie(flowCookieValue(flow))).toEqual(flow);
    for (const value of [
      undefined,
      "",
      flow.state,
      `${flow.state}.${flow.verifier}.extra`,
      `${flow.state}.short`,
    ]) {
      expect(readFlowCookie(value)).toBeUndefined();
    }
  });
});

describe("GET /auth/google/start", () => {
  it("T-API-S262: 503 without the client or WEB_ORIGIN, 403 cross-site, else a 302 to Google with PKCE, openid only, and a short-lived __Host- flow cookie", async () => {
    const request = (site?: string) =>
      new NextRequest(new URL("/auth/google/start", API), {
        headers: site ? { "sec-fetch-site": site } : {},
      });

    for (const missing of [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "WEB_ORIGIN",
    ]) {
      vi.stubEnv(missing, "");
      const response = await startGet(request("same-site"));
      expect(response.status).toBe(503);
      expect(setCookies(response)).toEqual([]);
      vi.stubEnv(missing, missing === "WEB_ORIGIN" ? WEB : "x");
    }
    vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);

    expect((await startGet(request("cross-site"))).status).toBe(403);

    const response = await startGet(request("same-site"));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    const params = location.searchParams;
    expect([...params.keys()].sort()).toEqual([
      "client_id",
      "code_challenge",
      "code_challenge_method",
      "prompt",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
    ]);
    expect(params.get("client_id")).toBe(CLIENT_ID);
    expect(params.get("redirect_uri")).toBe(`${API}/auth/google/callback`);
    expect(params.get("response_type")).toBe("code");
    expect(params.get("scope")).toBe("openid");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("prompt")).toBe("select_account");

    const [cookie, ...others] = setCookies(response);
    expect(others).toEqual([]);
    expect(cookie?.startsWith("__Host-miolos_google=")).toBe(true);
    const flow = readFlowCookie(cookie?.split(";")[0]?.split("=")[1]);
    expect(flow?.state).toBe(params.get("state"));
    const challenge = Buffer.from(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(flow?.verifier ?? ""),
      ),
    ).toString("base64url");
    expect(params.get("code_challenge")).toBe(challenge);
    expect(cookie).toContain("; Path=/;");
    expect(cookie).toContain("Max-Age=600");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Domain=");
  });
});

describe("GET /auth/google/callback", () => {
  it("T-API-S263: every refusal lands on Ajustes as failed, clears the flow cookie and writes nothing; unconfigured, it is a bare 503", async () => {
    const { userId, token } = await createUser();
    const flow = startFlow();
    const tokenEndpoint = stubTokenEndpoint(() =>
      Response.json({ id_token: idToken(claimsFor("sub-x")) }),
    );
    const good = { code: "c", state: flow.state };

    const refusals = [
      callbackRequest({ session: token, query: good }),
      callbackRequest({
        flow,
        session: token,
        query: { code: "c", state: "x" },
      }),
      callbackRequest({ flow, session: token, query: { state: flow.state } }),
      callbackRequest({
        flow,
        session: token,
        query: { error: "access_denied", state: flow.state },
      }),
    ];
    for (const request of refusals) {
      const response = await callbackGet(request);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        `${WEB}/ajustes?google=failed`,
      );
      const cookies = setCookies(response);
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toMatch(/^__Host-miolos_google=; Path=\/; Max-Age=0/);
    }
    expect(tokenEndpoint).not.toHaveBeenCalled();

    stubTokenEndpoint(() => new Response("bad", { status: 400 }));
    const rejected = await callbackGet(
      callbackRequest({ flow, session: token, query: good }),
    );
    expect(rejected.headers.get("location")).toBe(
      `${WEB}/ajustes?google=failed`,
    );

    stubTokenEndpoint(() =>
      Response.json({
        id_token: idToken({ ...claimsFor("sub-x"), aud: "other" }),
      }),
    );
    const wrongAudience = await callbackGet(
      callbackRequest({ flow, session: token, query: good }),
    );
    expect(wrongAudience.headers.get("location")).toBe(
      `${WEB}/ajustes?google=failed`,
    );

    for (const missing of ["GOOGLE_CLIENT_SECRET", "WEB_ORIGIN"]) {
      vi.stubEnv(missing, "");
      const unconfigured = await callbackGet(
        callbackRequest({ flow, session: token, query: good }),
      );
      expect(unconfigured.status).toBe(503);
      expect(setCookies(unconfigured)).toEqual([]);
      vi.stubEnv(missing, missing === "WEB_ORIGIN" ? WEB : "client-secret");
    }

    expect(await googleIdOf(userId)).toBeNull();
    expect(await requireUserId(ctx.db, token)).toBe(userId);
  });

  it("T-API-S264: the token exchange sends the code, the PKCE verifier and our redirect URI", async () => {
    const flow = startFlow();
    const tokenEndpoint = stubTokenEndpoint(() =>
      Response.json({ id_token: idToken(claimsFor("sub-1")) }),
    );
    await callbackGet(
      callbackRequest({
        flow,
        query: { code: "auth-code", state: flow.state },
      }),
    );
    expect(tokenEndpoint).toHaveBeenCalledTimes(1);
    const [url, init] = tokenEndpoint.mock.calls[0] ?? [];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = Object.fromEntries(init?.body ?? []);
    expect(body).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      client_id: CLIENT_ID,
      client_secret: "client-secret",
      redirect_uri: `${API}/auth/google/callback`,
      code_verifier: flow.verifier,
    });
  });

  it("T-API-S265: a signed-in account with no Google gets it linked, and the browser leaves with a fresh session while the presented token dies", async () => {
    const { userId, token } = await createUser({
      email: "jogadora@example.com",
    });
    const response = await signIn({ sub: "sub-1", session: token });
    expect(response.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    expect(await googleIdOf(userId)).toBe("sub-1");
    const fresh = sessionTokenOf(response);
    expect(fresh).not.toBe(token);
    expect(await requireUserId(ctx.db, fresh)).toBe(userId);
    expect(await requireUserId(ctx.db, token)).toBeUndefined();

    const again = await signIn({ sub: "sub-1", session: fresh });
    expect(again.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    expect(await requireUserId(ctx.db, sessionTokenOf(again))).toBe(userId);
  });

  it("T-API-S266: without a session cookie, the Google holder gets a fresh session, and an unknown Google account becomes a new linked account", async () => {
    const holder = await createUser({ googleId: "sub-1" });
    const known = await signIn({ sub: "sub-1" });
    expect(known.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    expect(await requireUserId(ctx.db, sessionTokenOf(known))).toBe(
      holder.userId,
    );
    expect(await requireUserId(ctx.db, holder.token)).toBe(holder.userId);

    const unknown = await signIn({ sub: "sub-2" });
    const freshId = await requireUserId(ctx.db, sessionTokenOf(unknown));
    expect(freshId).toBeDefined();
    expect(freshId).not.toBe(holder.userId);
    expect(await googleIdOf(freshId ?? "")).toBe("sub-2");
  });

  it("T-API-S267: an anonymous device signing in merges into the Google account, even when the device is older; the device's old token dies and the holder's other devices stay signed in", async () => {
    const device = await createUser({
      createdAt: new Date("2026-01-01T12:00:00Z"),
    });
    const holder = await createUser({
      createdAt: new Date("2026-06-01T12:00:00Z"),
      googleId: "sub-1",
    });
    await insertWin(device.userId);

    const response = await signIn({ sub: "sub-1", session: device.token });
    expect(response.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    expect(await requireUserId(ctx.db, sessionTokenOf(response))).toBe(
      holder.userId,
    );
    expect(await requireUserId(ctx.db, device.token)).toBeUndefined();
    expect(await requireUserId(ctx.db, holder.token)).toBe(holder.userId);
    expect(await googleIdOf(holder.userId)).toBe("sub-1");
    expect(await completionOwners()).toEqual([{ userId: holder.userId }]);
  });

  it("T-API-S275: an anonymous device is never linked in place: it merges into the Google account (a new one when Google is unknown) and none of its sessions follow; an identified account links in place and keeps its sessions", async () => {
    const device = await createUser();
    const planted = await addSession(device.userId);
    const holder = await createUser({ googleId: "sub-1" });
    const merged = await signIn({ sub: "sub-1", session: device.token });
    expect(merged.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    expect(await requireUserId(ctx.db, planted)).toBeUndefined();
    expect(await requireUserId(ctx.db, holder.token)).toBe(holder.userId);
    expect(await requireUserId(ctx.db, sessionTokenOf(merged))).toBe(
      holder.userId,
    );

    const linker = await createUser();
    const linkerOther = await addSession(linker.userId);
    await insertWin(linker.userId);
    const linked = await signIn({ sub: "sub-2", session: linker.token });
    expect(linked.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    const googleAccount = await requireUserId(ctx.db, sessionTokenOf(linked));
    expect(googleAccount).not.toBe(linker.userId);
    expect(await googleIdOf(googleAccount ?? "")).toBe("sub-2");
    expect(await googleIdOf(linker.userId)).toBeNull();
    expect(await requireUserId(ctx.db, linkerOther)).toBeUndefined();
    expect(await requireUserId(ctx.db, linker.token)).toBeUndefined();
    expect(await completionOwners()).toEqual([{ userId: googleAccount }]);

    const identified = await createUser({ email: "jogadora@example.com" });
    const laptop = await addSession(identified.userId);
    await signIn({ sub: "sub-3", session: identified.token });
    expect(await googleIdOf(identified.userId)).toBe("sub-3");
    expect(await requireUserId(ctx.db, laptop)).toBe(identified.userId);
  });

  it("T-API-S276: a magic link for the anonymous device, pending or minted after the sign-in, cannot attach an email anywhere", async () => {
    const device = await createUser();
    const raw = generateSessionToken();
    await mintAttachToken(ctx.db, {
      userId: device.userId,
      email: "outra-pessoa@example.com",
      reminderConsent: false,
      tokenHash: await hashSessionToken(raw),
    });

    const linked = await signIn({ sub: "sub-1", session: device.token });
    expect(linked.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    const late = generateSessionToken();
    await mintAttachToken(ctx.db, {
      userId: device.userId,
      email: "outra-pessoa@example.com",
      reminderConsent: false,
      tokenHash: await hashSessionToken(late),
    });

    for (const token of [raw, late]) {
      const confirm = await confirmPost(
        new NextRequest(`${API}/attach/confirm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      );
      expect(confirm.status).toBe(410);
    }
    const emails = await ctx.db
      .select({ email: users.email })
      .from(users)
      .where(sql`email is not null`);
    expect(emails).toEqual([]);
  });

  it("T-API-S279: a sign-in that read the anonymous device before another one merged it lands only on its own Google account", async () => {
    const device = await createUser();
    await insertWin(device.userId);
    const victim = await signIn({ sub: "victim-sub", session: device.token });
    const victimAccount = await requireUserId(ctx.db, sessionTokenOf(victim));

    const late = generateSessionToken();
    const outcome = await resolveGoogleSignIn(ctx.db, "attacker-sub", {
      requesterId: device.userId,
      presentedHash: undefined,
      freshHash: await hashSessionToken(late),
    });
    expect(outcome).toBe("ok");
    const attackerAccount = await requireUserId(ctx.db, late);
    expect(attackerAccount).not.toBe(victimAccount);
    expect(await googleIdOf(attackerAccount ?? "")).toBe("attacker-sub");
    const onVictim = await ctx.db
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(sql`user_id = ${victimAccount}`);
    expect(onVictim).toHaveLength(1);
    expect(await completionOwners()).toEqual([{ userId: victimAccount }]);
  });

  it("T-API-S277: while the merge runs, a planted copy of the device's cookie already resolves to nothing", async () => {
    const device = await createUser();
    const planted = await addSession(device.userId);
    const holder = await createUser({ googleId: "sub-1" });
    let during: number | undefined;
    mergeHook.after = async () => {
      const response = await attachRequestPost(
        new NextRequest(`${API}/attach/request`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${SESSION_COOKIE_NAME}=${planted}`,
          },
          body: JSON.stringify({ email: "intrusa@example.com" }),
        }),
      );
      during = response.status;
    };

    const merged = await signIn({ sub: "sub-1", session: device.token });
    expect(merged.headers.get("location")).toBe(`${WEB}/ajustes?google=ok`);
    expect(during).toBe(401);
    expect(await requireUserId(ctx.db, sessionTokenOf(merged))).toBe(
      holder.userId,
    );
  });

  it("T-API-S278: a Google id that leaves its account mid-flow fails the sign-in; the device keeps a working session", async () => {
    const device = await createUser();
    const holder = await createUser({
      createdAt: new Date("2026-01-01T12:00:00Z"),
      googleId: "sub-1",
    });
    mergeHook.after = async () => {
      await ctx.db
        .update(users)
        .set({ googleId: null })
        .where(sql`id = ${holder.userId}`);
    };
    const response = await signIn({ sub: "sub-1", session: device.token });
    expect(response.headers.get("location")).toBe(
      `${WEB}/ajustes?google=failed`,
    );
    expect(await requireUserId(ctx.db, sessionTokenOf(response))).toBe(
      holder.userId,
    );
    expect(await requireUserId(ctx.db, device.token)).toBeUndefined();
  });

  it("T-API-S280: an email and a session that land on the anonymous device while it merges die with it", async () => {
    const device = await createUser();
    const holder = await createUser({ googleId: "sub-1" });
    const attacker = generateSessionToken();
    let fired = false;
    const race = async () => {
      fired = true;
      await attachEmailToUser(ctx.db, {
        userId: device.userId,
        email: "intrusa@example.com",
        reminderConsent: false,
        tokenCreatedAt: new Date(),
      });
      await createSessionForUser(
        ctx.db,
        await hashSessionToken(attacker),
        device.userId,
      );
    };
    const raced = new Proxy(ctx.db, {
      get(target, key, receiver) {
        const original = Reflect.get(target, key, receiver) as unknown;
        if (key !== "delete" && key !== "update") {
          return original;
        }
        return (table: typeof sessions) => {
          if (table !== sessions || fired) {
            return (original as (t: unknown) => unknown).call(target, table);
          }
          if (key === "delete") {
            return {
              where: async (condition: never) => {
                await race();
                return target.delete(table).where(condition);
              },
            };
          }
          return {
            set: (values: never) => ({
              where: async (condition: never) => {
                await race();
                return target.update(table).set(values).where(condition);
              },
            }),
          };
        };
      },
    });

    const fresh = generateSessionToken();
    const outcome = await resolveGoogleSignIn(raced, "sub-1", {
      requesterId: device.userId,
      presentedHash: await hashSessionToken(device.token),
      freshHash: await hashSessionToken(fresh),
    });
    expect(fired).toBe(true);
    expect(outcome).toBe("ok");
    expect(await requireUserId(ctx.db, attacker)).toBeUndefined();
    expect(await requireUserId(ctx.db, fresh)).toBe(holder.userId);
    const onHolder = await ctx.db
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(sql`user_id = ${holder.userId}`);
    expect(onHolder).toHaveLength(2);
    const emails = await ctx.db
      .select({ email: users.email })
      .from(users)
      .where(sql`email is not null`);
    expect(emails).toEqual([]);
  });

  it("T-API-S281: a merge that fails before touching sessions leaves the device and its cookie as they were", async () => {
    const device = await createUser();
    await insertWin(device.userId);
    const holder = await createUser({ googleId: "sub-1" });
    mergeHook.before = () => Promise.reject(new Error("database went away"));
    const response = await signIn({ sub: "sub-1", session: device.token });
    expect(response.headers.get("location")).toBe(
      `${WEB}/ajustes?google=failed`,
    );
    expect(sessionTokenOf(response)).toBeUndefined();
    expect(await requireUserId(ctx.db, device.token)).toBe(device.userId);
    expect(await completionOwners()).toEqual([{ userId: device.userId }]);
    const onHolder = await ctx.db
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(sql`user_id = ${holder.userId}`);
    expect(onHolder).toHaveLength(1);
  });

  it("T-API-S282: a Google account that unlinks before an older device merges into it keeps its sessions, and the device keeps its cookie", async () => {
    const device = await createUser({
      createdAt: new Date("2026-01-01T12:00:00Z"),
    });
    await insertWin(device.userId);
    const holder = await createUser({ googleId: "sub-1" });
    const laptop = await addSession(holder.userId);
    mergeHook.before = async () => {
      await ctx.db
        .update(users)
        .set({ googleId: null })
        .where(sql`id = ${holder.userId}`);
    };
    const response = await signIn({ sub: "sub-1", session: device.token });
    expect(response.headers.get("location")).toBe(
      `${WEB}/ajustes?google=failed`,
    );
    expect(sessionTokenOf(response)).toBeUndefined();
    expect(await requireUserId(ctx.db, device.token)).toBe(device.userId);
    expect(await requireUserId(ctx.db, laptop)).toBe(holder.userId);
    expect(await requireUserId(ctx.db, holder.token)).toBe(holder.userId);
    expect(await completionOwners()).toEqual([{ userId: device.userId }]);
  });

  it("T-API-S268: a device signed in to another identified account switches to the Google account, says so, and merges nothing", async () => {
    const other = await createUser({ email: "outra@example.com" });
    const holder = await createUser({ googleId: "sub-1" });
    await insertWin(other.userId);

    const response = await signIn({ sub: "sub-1", session: other.token });
    expect(response.headers.get("location")).toBe(
      `${WEB}/ajustes?google=switched`,
    );
    expect(await requireUserId(ctx.db, sessionTokenOf(response))).toBe(
      holder.userId,
    );
    expect(await requireUserId(ctx.db, other.token)).toBeUndefined();
    expect(await completionOwners()).toEqual([{ userId: other.userId }]);
    const otherRow = await ctx.db
      .select({ email: users.email, googleId: users.googleId })
      .from(users)
      .where(sql`id = ${other.userId}`);
    expect(otherRow).toEqual([{ email: "outra@example.com", googleId: null }]);
  });

  it("T-API-S269: an account already linked to a different Google account answers conflict and changes nothing", async () => {
    const { userId, token } = await createUser({ googleId: "sub-1" });
    const response = await signIn({ sub: "sub-2", session: token });
    expect(response.headers.get("location")).toBe(
      `${WEB}/ajustes?google=conflict`,
    );
    expect(sessionTokenOf(response)).toBeUndefined();
    expect(await requireUserId(ctx.db, token)).toBe(userId);
    expect(await googleIdOf(userId)).toBe("sub-1");
    expect(
      await ctx.db
        .select()
        .from(users)
        .where(sql`google_id = 'sub-2'`),
    ).toEqual([]);
  });
});

describe("POST /account/unlink-google", () => {
  function unlinkRequest(init: {
    token?: string;
    body?: unknown;
    site?: string;
  }): NextRequest {
    const headers = new Headers({ "content-type": "application/json" });
    if (init.token) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${init.token}`);
    }
    if (init.site) {
      headers.set("sec-fetch-site", init.site);
    }
    return new NextRequest(new URL("/account/unlink-google", API), {
      method: "POST",
      headers,
      body: JSON.stringify(init.body ?? { confirm: true }),
    });
  }

  it("T-API-S271: unlinks the caller's Google only, works with the client unconfigured, answers 409 no-google when none is linked, and keeps the preamble's refusals", async () => {
    const { userId, token } = await createUser({ googleId: "sub-1" });
    const other = await createUser({ googleId: "sub-2" });

    expect(
      (await unlinkPost(unlinkRequest({ token, site: "cross-site" }))).status,
    ).toBe(403);
    expect((await unlinkPost(unlinkRequest({}))).status).toBe(401);
    expect(
      (await unlinkPost(unlinkRequest({ token, body: { confirm: false } })))
        .status,
    ).toBe(400);
    expect(await googleIdOf(userId)).toBe("sub-1");

    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    const response = await unlinkPost(unlinkRequest({ token }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unlinked: true });
    expect(await googleIdOf(userId)).toBeNull();
    expect(await googleIdOf(other.userId)).toBe("sub-2");
    expect(await requireUserId(ctx.db, token)).toBe(userId);

    const again = await unlinkPost(unlinkRequest({ token }));
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "no-google" });
  });
});

describe("GET /account/google", () => {
  it("T-API-S272: unavailable until the client and WEB_ORIGIN exist, then unlinked or linked; a linked account reads linked even unconfigured, so it can always unlink", async () => {
    const { userId, token } = await createUser();
    const read = async () => {
      const response = await googleStateGet(
        new NextRequest(new URL("/account/google", API), {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
        }),
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      return ((await response.json()) as { google: string }).google;
    };

    expect(await read()).toBe("unlinked");
    for (const missing of [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "WEB_ORIGIN",
    ]) {
      vi.stubEnv(missing, "");
      expect(await read()).toBe("unavailable");
      vi.stubEnv(missing, missing === "WEB_ORIGIN" ? WEB : "x");
    }

    await ctx.db
      .update(users)
      .set({ googleId: "sub-1" })
      .where(sql`id = ${userId}`);
    expect(await read()).toBe("linked");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(await read()).toBe("linked");

    const anonymous = await googleStateGet(
      new NextRequest(new URL("/account/google", API)),
    );
    expect(anonymous.status).toBe(401);
  });
});
