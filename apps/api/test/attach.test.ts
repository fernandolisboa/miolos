import { streakResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { attachTokens, completions } from "@miolos/db/user";
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

import { POST as confirmPost } from "../app/attach/confirm/route";
import { POST as dismissPost } from "../app/attach/dismiss/route";
import { POST as requestPost } from "../app/attach/request/route";
import { GET as streakGet } from "../app/streak/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { requireUserId } from "../src/session/service";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

// Seam 4 for #21 (plan 031 §10): the real attach request/confirm/dismiss
// handlers over PGlite, with src/db and the EMAIL TRANSPORT as the only
// behavioural mocks. The raw magic-link token is HARVESTED from the mocked
// transport's URL argument — the same string a human would click is what
// drives every confirm below, which is what makes "transport faked" an
// end-to-end claim rather than a unit one.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

/** When set, the routes see this instead of the real db — the no-DB-touch
 *  probes swap in a client whose every access throws. */
let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? ctx.db,
}));

// The transport fake (D11): importOriginal is spread so the REAL
// `isAttachConfigured` (env-derived at call time — vi.stubEnv drives the
// dormancy switch) survives, and only the send is overridden with a spy
// recording {to, url} (step-7 finding F: no re-declared module surface).
const sendSpy = vi.hoisted(() =>
  vi.fn<(init: { to: string; url: string }) => Promise<void>>(() =>
    Promise.resolve(),
  ),
);
vi.mock("../src/email/transport", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/email/transport")>();
  return { ...actual, sendMagicLinkEmail: sendSpy };
});

// T-API-S73's lever: a pass-through mergeAccounts that can be told to
// throw the winner-liveness guard's error N times before delegating — the
// only way to schedule the concurrent-merge shape deterministically.
// `failWith` (T-API-S83) swaps the thrown error for a NON-guard one, so
// the route's catch taxonomy is pinned: only the guard error is retryable.
const mergeControl = vi.hoisted(() => ({
  failuresRemaining: 0,
  calls: 0,
  failWith: undefined as string | undefined,
}));
vi.mock("@miolos/db/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/db/user")>();
  const mergeAccounts: typeof actual.mergeAccounts = async (db, a, b) => {
    mergeControl.calls += 1;
    if (mergeControl.failuresRemaining > 0) {
      mergeControl.failuresRemaining -= 1;
      throw new Error(
        mergeControl.failWith ??
          "mergeAccounts: winner owns no session or identity handle (concurrent merge?)",
      );
    }
    return actual.mergeAccounts(db, a, b);
  };
  return { ...actual, mergeAccounts };
});

// T-API-S80's lever: attachEmailToUser made to throw the partial-index
// violation exactly once — the concurrent-confirm window where the holder
// lookup returned null cannot be reached by sequential statements.
const attachControl = vi.hoisted(() => ({ failUniqueOnce: false }));
vi.mock("../src/attach/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/attach/service")>();
  const attachEmailToUser: typeof actual.attachEmailToUser = async (
    db,
    init,
  ) => {
    if (attachControl.failUniqueOnce) {
      attachControl.failUniqueOnce = false;
      throw new Error(
        'duplicate key value violates unique constraint "users_verified_email_uq"',
      );
    }
    return actual.attachEmailToUser(db, init);
  };
  return { ...actual, attachEmailToUser };
});

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  // `cascade` from users reaches sessions, completions and attach_tokens.
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
  vi.stubEnv("WEB_ORIGIN", WEB);
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
});

afterEach(() => {
  dbOverride = undefined;
  sendSpy.mockClear();
  sendSpy.mockImplementation(() => Promise.resolve());
  mergeControl.failuresRemaining = 0;
  mergeControl.calls = 0;
  mergeControl.failWith = undefined;
  attachControl.failUniqueOnce = false;
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

const WEB = "https://miolos.app";
const EMAIL = "jogadora@example.com";
const VALID_BODY = {
  email: EMAIL,
  recoveryConsent: true,
  reminderConsent: false,
} as const;

// Pinned birthdays: the winner rule (older created_at) applied by hand.
const OLDER = new Date("2026-01-01T12:00:00.000Z");
const NEWER = new Date("2026-06-01T12:00:00.000Z");

/** A fresh identity with a live session cookie — the routes never mint. */
async function createSession(
  createdAt?: Date,
): Promise<{ token: string; userId: string }> {
  const inserted = await ctx.db
    .insert(users)
    .values(createdAt ? { createdAt, updatedAt: createdAt } : {})
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

function jsonHeaders(sessionToken?: string): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (sessionToken !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
  }
  return headers;
}

async function postRequest(
  sessionToken: string | undefined,
  body: unknown,
  headers?: Headers,
): Promise<Response> {
  return requestPost(
    new NextRequest("http://localhost:3001/attach/request", {
      method: "POST",
      headers: headers ?? jsonHeaders(sessionToken),
      body: JSON.stringify(body),
    }),
  );
}

/** Run the real request route and harvest the raw token from the link. */
async function requestMagicLink(
  sessionToken: string,
  body: typeof VALID_BODY | { [key: string]: unknown } = VALID_BODY,
): Promise<string> {
  const response = await postRequest(sessionToken, body);
  expect(response.status).toBe(200);
  const call = sendSpy.mock.calls.at(-1)?.[0];
  if (!call) {
    throw new Error("transport was not called");
  }
  const raw = new URL(call.url).searchParams.get("token");
  if (!raw) {
    throw new Error("no token in the magic-link URL");
  }
  return raw;
}

async function postConfirm(rawToken: string): Promise<Response> {
  // No session cookie, deliberately: the recovery browser may have none
  // (D3), and D4 is the authorization.
  return confirmPost(
    new NextRequest("http://localhost:3001/attach/confirm", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: JSON.stringify({ token: rawToken }),
    }),
  );
}

function cookieTokenOf(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = /miolos_session=([^;]+)/.exec(header);
  const value = match?.[1];
  if (!value) {
    throw new Error("no session cookie on the response");
  }
  return value;
}

async function userRow(userId: string) {
  const rows = await ctx.db
    .select()
    .from(users)
    .where(sql`id = ${userId}`);
  const row = rows[0];
  if (!row) {
    throw new Error(`no users row for ${userId}`);
  }
  return row;
}

/** An on-time win for `date` (the merge-resolution.test.ts fixture idiom). */
async function insertOnTimeWin(init: {
  userId: string;
  date: string;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: "binairo",
    date: init.date,
    outcome: "won",
    completedAt: new Date(`${init.date}T15:00:00Z`),
    elapsedMs: 61_000,
    hintsUsed: 0,
  });
}

async function readStreak(sessionToken: string): Promise<number> {
  const response = await streakGet(
    new NextRequest("http://localhost:3001/streak", {
      method: "GET",
      headers: new Headers({
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      }),
    }),
  );
  expect(response.status).toBe(200);
  return streakResponseSchema.parse(await response.json()).streak;
}

describe("POST /attach/request — gates and fail-closed (plan 031 §7)", () => {
  it("T-API-S57: cross-site positive evidence is 403 before any DB touch", async () => {
    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("the guard must run before getDb()");
      },
    });
    const headers = jsonHeaders();
    headers.set("origin", "https://evil.example");
    headers.set("sec-fetch-site", "cross-site");

    const response = await postRequest(undefined, VALID_BODY, headers);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "cross-site" });
  });

  it("T-API-S58: a non-JSON content type is 415, still before any DB touch", async () => {
    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("the JSON gate must run before getDb()");
      },
    });
    const response = await requestPost(
      new NextRequest("http://localhost:3001/attach/request", {
        method: "POST",
        headers: new Headers({ "content-type": "text/plain" }),
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "unsupported-media-type" });
  });

  it("T-API-S59: no cookie and an unknown cookie are 401 no-session, and nothing is minted", async () => {
    const noCookie = await postRequest(undefined, VALID_BODY);
    expect(noCookie.status).toBe(401);

    const unknown = await postRequest(generateSessionToken(), VALID_BODY);
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual({ error: "no-session" });

    expect(await ctx.db.select().from(users)).toHaveLength(0);
    expect(await ctx.db.select().from(attachTokens)).toHaveLength(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("T-API-S60: a bad email, a false or absent recoveryConsent, and an absent reminderConsent are all 400", async () => {
    const { token } = await createSession();

    for (const body of [
      { ...VALID_BODY, email: "não-é-email" },
      { ...VALID_BODY, recoveryConsent: false },
      { email: EMAIL, reminderConsent: false },
      { email: EMAIL, recoveryConsent: true },
      { ...VALID_BODY, extra: 1 },
    ]) {
      const response = await postRequest(token, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid-body" });
    }
    expect(await ctx.db.select().from(attachTokens)).toHaveLength(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("T-API-S61: fail-closed — no RESEND_API_KEY (or no WEB_ORIGIN) is 503 with zero token rows and no transport call", async () => {
    const { token } = await createSession();

    vi.stubEnv("RESEND_API_KEY", undefined);
    const noKey = await postRequest(token, VALID_BODY);
    expect(noKey.status).toBe(503);
    expect(await noKey.json()).toEqual({ error: "email-unconfigured" });

    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("WEB_ORIGIN", undefined);
    const noOrigin = await postRequest(token, VALID_BODY);
    expect(noOrigin.status).toBe(503);
    expect(await noOrigin.json()).toEqual({ error: "email-unconfigured" });

    expect(await ctx.db.select().from(attachTokens)).toHaveLength(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("T-API-S62: the happy path mints ONE hash-only row and sends the normalized address one /vincular URL with a 43-char token", async () => {
    const { token } = await createSession();

    const raw = await requestMagicLink(token, {
      email: "  Jogadora@Example.COM ",
      recoveryConsent: true,
      reminderConsent: false,
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const call = sendSpy.mock.calls[0]?.[0];
    expect(call?.to).toBe(EMAIL); // trimmed + lowercased at the boundary
    expect(call?.url).toBe(`${WEB}/vincular?token=${raw}`);
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Hash-only storage: the raw token appears nowhere in the DB; its
    // SHA-256 hex does.
    const rows = await ctx.db.select().from(attachTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(await hashSessionToken(raw));
    expect(rows[0]?.tokenHash).not.toBe(raw);
    expect(rows[0]?.email).toBe(EMAIL);
  });

  it("T-API-S63: the request writes NOTHING to users — consents ride the token row per the checkbox", async () => {
    const { token, userId } = await createSession(OLDER);

    await requestMagicLink(token, {
      email: EMAIL,
      recoveryConsent: true,
      reminderConsent: true,
    });

    // AC 3's first half: saving the streak never signs the player up for
    // mail — no consent, no email, no bump lands on users at request time.
    const row = await userRow(userId);
    expect(row.email).toBeNull();
    expect(row.emailVerifiedAt).toBeNull();
    expect(row.recoveryConsentAt).toBeNull();
    expect(row.reminderConsentAt).toBeNull();
    expect(row.updatedAt.toISOString()).toBe(OLDER.toISOString());

    const tokens = await ctx.db.select().from(attachTokens);
    expect(tokens[0]?.reminderConsent).toBe(true);
  });

  it("T-API-S64: expired-but-recent rows still rate-limit (no cleanup-before-count loosening), and rows older than the hour ARE cleaned up", async () => {
    const { token, userId } = await createSession();

    for (let i = 0; i < 3; i += 1) {
      await requestMagicLink(token);
    }
    // 31 minutes old: EXPIRED for the claim, INSIDE the 1-hour rate
    // window. Cleanup at the 30-minute expiry would delete these and make
    // the real cap 6/hour — this fixture is what catches that loosening
    // (four quick requests cannot).
    await ctx.db.execute(
      sql`update attach_tokens set created_at = now() - interval '31 minutes' where user_id = ${userId}`,
    );

    const fourth = await postRequest(token, VALID_BODY);
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toEqual({ error: "too-many-requests" });
    expect(sendSpy).toHaveBeenCalledTimes(3);

    // Past the rate window the rows are the cleanup's business (D12).
    await ctx.db.execute(
      sql`update attach_tokens set created_at = now() - interval '2 hours' where user_id = ${userId}`,
    );
    const fifth = await postRequest(token, VALID_BODY);
    expect(fifth.status).toBe(200);
    expect(await ctx.db.select().from(attachTokens)).toHaveLength(1);
  });

  it("T-API-S65: an attached account may resend its own address; a different address is 409 (D16)", async () => {
    const { token, userId } = await createSession();
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${userId}`);

    const different = await postRequest(token, {
      ...VALID_BODY,
      email: "outra@example.com",
    });
    expect(different.status).toBe(409);
    expect(await different.json()).toEqual({ error: "email-already-attached" });
    expect(sendSpy).not.toHaveBeenCalled();

    const same = await postRequest(token, VALID_BODY);
    expect(same.status).toBe(200);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("T-API-S81: the per-email cap closes the mint-fresh-users mail-bombing shape for one inbox (D12)", async () => {
    // Three DISTINCT fresh users each request the same normalized email —
    // the per-user count is 1 for each, so only the per-email count can
    // stop the fourth.
    for (let i = 0; i < 3; i += 1) {
      const { token } = await createSession();
      await requestMagicLink(token);
    }
    const fourth = await createSession();
    const response = await postRequest(fourth.token, VALID_BODY);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "too-many-requests" });
    expect(sendSpy).toHaveBeenCalledTimes(3);
  });
});

describe("POST /attach/confirm — attach, single use, expiry (plan 031 §7)", () => {
  it("T-API-S66: the no-collision confirm attaches to the requester, stamps recovery only, touches no completions, and sets a cookie resolving to the winner", async () => {
    const { token, userId } = await createSession(OLDER);
    const today = await todaySaoPaulo(ctx.db);
    await insertOnTimeWin({ userId, date: today });
    const raw = await requestMagicLink(token);

    const response = await postConfirm(raw);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ merged: false });

    // Token consumed; email + verified + recovery stamped in one UPDATE
    // with explicit updated_at; reminder stays NULL when unchecked.
    expect(await ctx.db.select().from(attachTokens)).toHaveLength(0);
    const row = await userRow(userId);
    expect(row.email).toBe(EMAIL);
    expect(row.emailVerifiedAt).toBeInstanceOf(Date);
    expect(row.recoveryConsentAt).toBeInstanceOf(Date);
    expect(row.reminderConsentAt).toBeNull();
    expect(row.updatedAt.getTime()).toBeGreaterThan(OLDER.getTime());

    // AC 5: the attach-without-collision path never touches completions.
    expect(await ctx.db.select().from(completions)).toHaveLength(1);

    // The clicking browser is authenticated AS the winner through the only
    // cookie→identity mechanism that exists.
    const cookieToken = cookieTokenOf(response);
    expect(await requireUserId(ctx.db, cookieToken)).toBe(userId);
  });

  it("T-API-S67: reminder consent — a true token stamps it; a false token leaves a pre-existing stamp untouched (unchecked ≠ withdrawal)", async () => {
    const consented = await createSession();
    const rawTrue = await requestMagicLink(consented.token, {
      email: EMAIL,
      recoveryConsent: true,
      reminderConsent: true,
    });
    expect((await postConfirm(rawTrue)).status).toBe(200);
    expect((await userRow(consented.userId)).reminderConsentAt).toBeInstanceOf(
      Date,
    );

    // A different account with an existing stamp, re-attaching with the
    // box unchecked: absence of NEW consent, never a withdrawal (D7).
    const stamped = await createSession();
    const priorStamp = new Date("2026-07-01T12:00:00.000Z");
    await ctx.db
      .update(users)
      .set({ reminderConsentAt: priorStamp })
      .where(sql`id = ${stamped.userId}`);
    const rawFalse = await requestMagicLink(stamped.token, {
      email: "outra@example.com",
      recoveryConsent: true,
      reminderConsent: false,
    });
    expect((await postConfirm(rawFalse)).status).toBe(200);
    expect(
      (await userRow(stamped.userId)).reminderConsentAt?.toISOString(),
    ).toBe(priorStamp.toISOString());
  });

  it("T-API-S68: single use — a second confirm of the same token is 410 and changes nothing", async () => {
    const { token, userId } = await createSession();
    const raw = await requestMagicLink(token);
    expect((await postConfirm(raw)).status).toBe(200);
    const after = await userRow(userId);

    const replay = await postConfirm(raw);
    expect(replay.status).toBe(410);
    expect(await replay.json()).toEqual({ error: "invalid-or-expired" });
    expect(await userRow(userId)).toEqual(after);
    expect(replay.headers.get("set-cookie")).toBeNull();
  });

  it("T-API-S69: a token older than 30 minutes is 410 with the one generic error — no oracle distinguishes expired from unknown", async () => {
    const { token } = await createSession();
    const raw = await requestMagicLink(token);
    await ctx.db.execute(
      sql`update attach_tokens set created_at = now() - interval '31 minutes'`,
    );

    const expired = await postConfirm(raw);
    expect(expired.status).toBe(410);
    expect(await expired.json()).toEqual({ error: "invalid-or-expired" });

    const unknown = await postConfirm(generateSessionToken());
    expect(unknown.status).toBe(410);
    expect(await unknown.json()).toEqual({ error: "invalid-or-expired" });
  });

  it("T-API-S70: merge-on-collision — winner per created_at, loser tombstoned, the email on the winner, and the new cookie's GET /streak serves the MERGED streak", async () => {
    const today = await todaySaoPaulo(ctx.db);
    // Holder X: OLDER (the deterministic winner), verified E, two on-time
    // days. Requester B: NEWER, two interleaved days — the union reads 4.
    const x = await createSession(OLDER);
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${x.userId}`);
    await insertOnTimeWin({ userId: x.userId, date: today });
    await insertOnTimeWin({ userId: x.userId, date: addDays(today, -2) });
    const b = await createSession(NEWER);
    await insertOnTimeWin({ userId: b.userId, date: addDays(today, -1) });
    await insertOnTimeWin({ userId: b.userId, date: addDays(today, -3) });

    const raw = await requestMagicLink(b.token);
    const response = await postConfirm(raw);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ merged: true });

    // Loser tombstoned: zero sessions, zero completions, no handles.
    const loser = await userRow(b.userId);
    expect(loser.email).toBeNull();
    expect(loser.emailVerifiedAt).toBeNull();
    expect(
      await ctx.db
        .select()
        .from(sessions)
        .where(sql`user_id = ${b.userId}`),
    ).toHaveLength(0);
    expect(
      await ctx.db
        .select()
        .from(completions)
        .where(sql`user_id = ${b.userId}`),
    ).toHaveLength(0);

    // The email lands on the WINNER (X), re-stamped by the confirm UPDATE.
    const winner = await userRow(x.userId);
    expect(winner.email).toBe(EMAIL);
    expect(winner.recoveryConsentAt).toBeInstanceOf(Date);

    // The clicking browser resolves to the winner, and the real deployed
    // read path serves the union's streak (AC 2 + AC 5 in one).
    const cookieToken = cookieTokenOf(response);
    expect(await requireUserId(ctx.db, cookieToken)).toBe(x.userId);
    expect(await readStreak(cookieToken)).toBe(4);
    // Post-merge revocation (step-7 finding A, ADR-0050 decision 13):
    // NEITHER pre-existing cookie survives a cross-account merge — the
    // clicking browser's fresh session is the only live one.
    expect(await requireUserId(ctx.db, b.token)).toBeUndefined();
    expect(await requireUserId(ctx.db, x.token)).toBeUndefined();
    expect(await ctx.db.select().from(sessions)).toHaveLength(1);
  });

  it("T-API-S71: recovery and device move, by name — a fresh empty account requesting the attached email resolves the clicking browser to the old history", async () => {
    const today = await todaySaoPaulo(ctx.db);
    // The old account: verified E, a 2-day streak.
    const old = await createSession(OLDER);
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${old.userId}`);
    await insertOnTimeWin({ userId: old.userId, date: today });
    await insertOnTimeWin({ userId: old.userId, date: addDays(today, -1) });

    // The cleared-site-data user AND the second device are this same
    // fixture: a fresh, empty account requests with the old email.
    const fresh = await createSession(NEWER);
    const raw = await requestMagicLink(fresh.token);
    const response = await postConfirm(raw);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ merged: true });

    const cookieToken = cookieTokenOf(response);
    expect(await requireUserId(ctx.db, cookieToken)).toBe(old.userId);
    expect(await readStreak(cookieToken)).toBe(2);
    // Recovery and device move end with EXACTLY one live session — the
    // clicking browser's (step-7 finding A): the old device's and the
    // fresh account's pre-existing cookies are revoked with the merge.
    expect(await ctx.db.select().from(sessions)).toHaveLength(1);
    expect(await requireUserId(ctx.db, old.token)).toBeUndefined();
    expect(await requireUserId(ctx.db, fresh.token)).toBeUndefined();
  });

  it("T-API-S72: a requester tombstoned between request and confirm gets 410 and no write anywhere", async () => {
    const { token, userId } = await createSession(OLDER);
    const raw = await requestMagicLink(token);
    // The concurrent-merge shape, manufactured: the requester's sessions
    // are gone (remapped away) by confirm time.
    await ctx.db.delete(sessions).where(sql`user_id = ${userId}`);

    const response = await postConfirm(raw);
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "invalid-or-expired" });

    const row = await userRow(userId);
    expect(row.email).toBeNull();
    expect(row.recoveryConsentAt).toBeNull();
    expect(row.updatedAt.toISOString()).toBe(OLDER.toISOString());
  });

  it("T-API-S73: a winner-liveness throw is retried once with a re-derived pair; a persistent failure is 409 with the token spent", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const x = await createSession(OLDER);
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${x.userId}`);
    await insertOnTimeWin({ userId: x.userId, date: today });
    const b = await createSession(NEWER);

    // One guard throw: the route re-derives and the retry succeeds.
    mergeControl.failuresRemaining = 1;
    const raw = await requestMagicLink(b.token);
    const retried = await postConfirm(raw);
    expect(retried.status).toBe(200);
    expect(await retried.json()).toEqual({ merged: true });
    expect(mergeControl.calls).toBe(2);

    // A persistent failure (astronomically rare): 409, and the atomically
    // claimed token is spent — the user requests a new link.
    await ctx.db.execute(sql`truncate table users cascade`);
    const x2 = await createSession(OLDER);
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${x2.userId}`);
    const b2 = await createSession(NEWER);
    const raw2 = await requestMagicLink(b2.token);
    mergeControl.failuresRemaining = 2;
    const conflicted = await postConfirm(raw2);
    expect(conflicted.status).toBe(409);
    expect(await conflicted.json()).toEqual({ error: "confirm-conflict" });
    const replay = await postConfirm(raw2);
    expect(replay.status).toBe(410);
  });

  it("T-API-S82: an attacker-requested token confirmed by the victim leaves the attacker's original cookie resolving to NOTHING — no pre-existing session survives a cross-account merge", async () => {
    const today = await todaySaoPaulo(ctx.db);
    // The victim: verified E, real history.
    const victim = await createSession(OLDER);
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${victim.userId}`);
    await insertOnTimeWin({ userId: victim.userId, date: today });
    // The attacker: a fresh account requesting a token for the VICTIM's
    // verified email (the request route cannot know the address is not
    // theirs), then waiting for the victim to click the mail.
    const attacker = await createSession(NEWER);
    const raw = await requestMagicLink(attacker.token);

    // The victim's browser clicks (no cookie rides the confirm, D3).
    const response = await postConfirm(raw);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ merged: true });

    // The takeover this pins shut (step-7 finding A): the merge's session
    // remap had just handed the attacker's cookie the victim's account —
    // the post-merge revocation retires it before any fresh session is
    // minted. The attacker's original cookie resolves to nothing…
    expect(await requireUserId(ctx.db, attacker.token)).toBeUndefined();
    // …the clicking browser's fresh cookie resolves to the winner…
    const cookieToken = cookieTokenOf(response);
    expect(await requireUserId(ctx.db, cookieToken)).toBe(victim.userId);
    // …that fresh session is the ONLY live one, and history is intact.
    expect(await ctx.db.select().from(sessions)).toHaveLength(1);
    expect(await readStreak(cookieToken)).toBe(1);
    expect(await ctx.db.select().from(completions)).toHaveLength(1);
  });

  it("T-API-S79a: the stale-intent guard runs BEFORE any merge — a live E2 token whose email has a verified holder is 409 with ZERO merge, holder untouched, no tombstone", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const E2 = "segunda@example.com";
    // The would-be victim: E2's verified holder, with history and a live
    // session of its own.
    const holder = await createSession(OLDER);
    await ctx.db
      .update(users)
      .set({ email: E2, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${holder.userId}`);
    await insertOnTimeWin({ userId: holder.userId, date: today });

    // The requester mints a token for E2 while unattached, then attaches
    // E1 — the E2 token now records a DEAD intent (T-API-S79's shape, the
    // verified-holder variant: without the pre-merge guard, confirm would
    // destructively merge the requester with E2's holder before 409ing).
    const requester = await createSession(NEWER);
    const rawE2 = await requestMagicLink(requester.token, {
      email: E2,
      recoveryConsent: true,
      reminderConsent: false,
    });
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${requester.userId}`);

    const response = await postConfirm(rawE2);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "email-already-attached" });
    // ZERO merge: the guard sits before resolveWinner ever runs.
    expect(mergeControl.calls).toBe(0);

    // The holder is untouched — no tombstone, handles, session and
    // history all intact.
    const holderRow = await userRow(holder.userId);
    expect(holderRow.email).toBe(E2);
    expect(holderRow.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await requireUserId(ctx.db, holder.token)).toBe(holder.userId);
    expect(
      await ctx.db
        .select()
        .from(completions)
        .where(sql`user_id = ${holder.userId}`),
    ).toHaveLength(1);
    // The requester keeps E1, and the stale token is spent.
    expect((await userRow(requester.userId)).email).toBe(EMAIL);
    expect((await postConfirm(rawE2)).status).toBe(410);
  });

  it("T-API-S83: a NON-guard mergeAccounts failure is never swallowed into 410/409 — it rethrows (the deployed 500, the completions route's own deliberate-500 idiom) with the error logged", async () => {
    const x = await createSession(OLDER);
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${x.userId}`);
    const b = await createSession(NEWER);
    const raw = await requestMagicLink(b.token);

    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      mergeControl.failuresRemaining = 1;
      mergeControl.failWith = "connection reset mid-merge";
      // The route rethrows: at this seam the rejection IS the framework
      // 500 on the deployed route, and it proves no catch flattened a
      // mid-merge failure into the spent-token answers.
      await expect(postConfirm(raw)).rejects.toThrow(
        "connection reset mid-merge",
      );
      // Not swallowed, and not retried either — the retry is reserved for
      // the guard's pre-destructive throw alone.
      expect(mergeControl.calls).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "attach confirm: mergeAccounts failed mid-operation",
        expect.any(Error),
      );
    } finally {
      errorSpy.mockRestore();
    }
    // Scope of this assertion, honestly: the lever throws BEFORE
    // delegating, so NO merge statement ran — this proves a
    // pre-operation failure leaves the holder untouched (email intact,
    // nothing tombstoned), and that the route swallowed none of it. It
    // proves NOTHING about half-run state: a real failure landing inside
    // statements 2–4 heals by re-run only in the requester-is-winner arm;
    // the holder-wins arm's stranding residual is recorded in ADR-0050
    // decision 5, with the nightly-check/support seam as the repair path.
    expect((await userRow(x.userId)).email).toBe(EMAIL);
  });

  it("T-API-S79: the pending-token side door is closed — a live token for E2 confirmed after E1 attached is 409, token spent, email unchanged", async () => {
    const { token, userId } = await createSession();
    const rawE2 = await requestMagicLink(token, {
      email: "segunda@example.com",
      recoveryConsent: true,
      reminderConsent: false,
    });
    // E1 becomes the verified email while the E2 token is still live.
    await ctx.db
      .update(users)
      .set({ email: EMAIL, emailVerifiedAt: sql`now()` })
      .where(sql`id = ${userId}`);

    const response = await postConfirm(rawE2);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "email-already-attached" });

    expect((await userRow(userId)).email).toBe(EMAIL);
    // Spent by the atomic claim — a stale intent is not resurrected.
    const replay = await postConfirm(rawE2);
    expect(replay.status).toBe(410);
  });

  it("T-API-S80: a users_verified_email_uq violation on the attach UPDATE maps to the same 409, token spent (the concurrent-confirm window)", async () => {
    const { token } = await createSession();
    const raw = await requestMagicLink(token);
    attachControl.failUniqueOnce = true;

    const response = await postConfirm(raw);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "confirm-conflict" });

    const replay = await postConfirm(raw);
    expect(replay.status).toBe(410);
  });
});

describe("POST /attach/dismiss — the permanent, idempotent decline (D9)", () => {
  it("T-API-S76: stamps dismissed_at with explicit updated_at, re-posts touch zero rows, the guards hold, and a non-empty body is 400", async () => {
    const { token, userId } = await createSession(OLDER);

    const response = await dismissPost(
      new NextRequest("http://localhost:3001/attach/dismiss", {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dismissed: true });

    const stamped = await userRow(userId);
    expect(stamped.attachPromptDismissedAt).toBeInstanceOf(Date);
    // Explicit updated_at, same statement, same DB now().
    expect(stamped.updatedAt.toISOString()).toBe(
      stamped.attachPromptDismissedAt?.toISOString(),
    );

    // Idempotent: the IS NULL guard makes the re-post a zero-row UPDATE —
    // neither stamp moves.
    const replay = await dismissPost(
      new NextRequest("http://localhost:3001/attach/dismiss", {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({}),
      }),
    );
    expect(replay.status).toBe(200);
    expect(await userRow(userId)).toEqual(stamped);

    // The write-route guards.
    const noSession = await dismissPost(
      new NextRequest("http://localhost:3001/attach/dismiss", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      }),
    );
    expect(noSession.status).toBe(401);

    const crossHeaders = jsonHeaders(token);
    crossHeaders.set("sec-fetch-site", "cross-site");
    const crossSite = await dismissPost(
      new NextRequest("http://localhost:3001/attach/dismiss", {
        method: "POST",
        headers: crossHeaders,
        body: JSON.stringify({}),
      }),
    );
    expect(crossSite.status).toBe(403);

    // z.strictObject({}): any key at all is a 400.
    const smuggled = await dismissPost(
      new NextRequest("http://localhost:3001/attach/dismiss", {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({ anything: true }),
      }),
    );
    expect(smuggled.status).toBe(400);
    expect(await smuggled.json()).toEqual({ error: "invalid-body" });
  });
});
