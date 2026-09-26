import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  detachAccountEmail,
  setReminderConsent,
} from "../src/account/account-client";

const API_URL = "https://api.example.test";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(respond: () => Promise<Response>) {
  const fetchMock = vi.fn(respond);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the account write calls parse their answers (T-WEB-S406)", () => {
  it("setReminderConsent posts {granted} and answers the server's boolean, or undefined on any failure", async () => {
    const fetchMock = stubFetch(() =>
      Promise.resolve(jsonResponse(200, { reminderConsent: false })),
    );
    expect(await setReminderConsent(false)).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/account/reminder-consent`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ granted: false }),
      }),
    );

    for (const respond of [
      () => Promise.resolve(jsonResponse(409, { error: "no-email" })),
      () => Promise.resolve(jsonResponse(200, { reminderConsent: "yes" })),
      () =>
        Promise.resolve(jsonResponse(200, { reminderConsent: true, extra: 1 })),
      () => Promise.reject(new TypeError("offline")),
    ]) {
      stubFetch(respond);
      expect(await setReminderConsent(true)).toBeUndefined();
    }
  });

  it("detachAccountEmail posts {confirm: true} and is true on the literal {detached: true}", async () => {
    const fetchMock = stubFetch(() =>
      Promise.resolve(jsonResponse(200, { detached: true })),
    );
    expect(await detachAccountEmail()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/account/detach-email`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      }),
    );

    for (const respond of [
      () => Promise.resolve(jsonResponse(409, { error: "cross-site" })),
      () => Promise.resolve(new Response("{", { status: 409 })),
      () => Promise.resolve(jsonResponse(200, { detached: false })),
      () => Promise.resolve(new Response("not json", { status: 200 })),
      () => Promise.reject(new TypeError("offline")),
    ]) {
      stubFetch(respond);
      expect(await detachAccountEmail()).toBe(false);
    }
  });
});

describe("a detach that finds no email is done, not failed (T-WEB-S410)", () => {
  it("a 409 no-email answers true; any other 409 answers false", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(409, { error: "no-email" })));
    expect(await detachAccountEmail()).toBe(true);

    stubFetch(() => Promise.resolve(jsonResponse(409, { error: "other" })));
    expect(await detachAccountEmail()).toBe(false);
  });
});
