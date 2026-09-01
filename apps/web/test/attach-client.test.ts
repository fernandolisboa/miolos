import type { AttachRequest } from "@miolos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmAttach,
  deleteAccount,
  dismissAttachPrompt,
  fetchAttachState,
  requestAttachLink,
} from "../src/attach/attach-client";

const API_URL = "https://api.example.test";

const REQUEST: AttachRequest = {
  email: "jogador@example.test",
  recoveryConsent: true,
  reminderConsent: false,
};

const TOKEN = "a".repeat(43);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(respond: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(() => Promise.resolve(respond()));
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

describe("attach-client (T-WEB-S361)", () => {
  it("logs loudly and fetches nothing when NEXT_PUBLIC_API_URL is unset — all five calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchAttachState()).toBeUndefined();
    expect(await requestAttachLink(REQUEST)).toBeUndefined();
    expect(await confirmAttach(TOKEN)).toBeUndefined();
    expect(await dismissAttachPrompt()).toBe(false);
    expect(await deleteAccount()).toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(5);
    expect(errorSpy.mock.calls.map((call) => String(call[0]))).toEqual(
      Array.from(
        { length: 5 },
        () =>
          "NEXT_PUBLIC_API_URL is unset: attach calls skipped, the prompt stays absent",
      ),
    );
  });

  it("every call is credentialed, and only the four writes carry a JSON body", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { eligible: true }));
    await fetchAttachState();
    const [stateUrl, stateInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(stateUrl).toBe(`${API_URL}/attach/state`);
    expect(stateInit).toEqual({ credentials: "include" });

    for (const [call, path, body] of [
      [() => requestAttachLink(REQUEST), "/attach/request", REQUEST],
      [() => confirmAttach(TOKEN), "/attach/confirm", { token: TOKEN }],
      [() => dismissAttachPrompt(), "/attach/dismiss", {}],
      [() => deleteAccount(), "/account/delete", { confirm: true }],
    ] as const) {
      const writes = stubFetch(() => jsonResponse(200, { sent: true }));
      await call();
      const [url, init] = writes.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url, path).toBe(`${API_URL}${path}`);
      expect(init.method, path).toBe("POST");
      expect(init.credentials, path).toBe("include");
      expect(init.headers, path).toEqual({
        "Content-Type": "application/json",
      });
      expect(init.body, path).toBe(JSON.stringify(body));
    }
  });

  it("fetchAttachState answers undefined on a non-ok status, an unparseable body and a throw alike", async () => {
    stubFetch(() => jsonResponse(500, { eligible: true }));
    expect(await fetchAttachState()).toBeUndefined();

    stubFetch(() => jsonResponse(200, { eligible: "yes" }));
    expect(await fetchAttachState()).toBeUndefined();

    stubFetch(() => jsonResponse(200, { eligible: true, extra: 1 }));
    expect(await fetchAttachState(), "the contract is strict").toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    expect(await fetchAttachState()).toBeUndefined();

    stubFetch(() => jsonResponse(200, { eligible: true }));
    expect(await fetchAttachState()).toEqual({ eligible: true });
  });

  it("requestAttachLink reads 429 and 409 as their own answers, never as a generic failure", async () => {
    stubFetch(() => jsonResponse(429, { error: "rate-limited" }));
    expect(await requestAttachLink(REQUEST)).toBe("rate-limited");

    stubFetch(() => jsonResponse(409, { error: "already-attached" }));
    expect(await requestAttachLink(REQUEST)).toBe("already-attached");

    stubFetch(() => jsonResponse(500, { error: "boom" }));
    expect(await requestAttachLink(REQUEST)).toBeUndefined();

    stubFetch(() => jsonResponse(200, { sent: "yes" }));
    expect(
      await requestAttachLink(REQUEST),
      "a 200 the contract refuses is not sent",
    ).toBeUndefined();

    stubFetch(() => jsonResponse(200, { sent: true }));
    expect(await requestAttachLink(REQUEST)).toBe("sent");
  });

  it("confirmAttach reads 410 and 409 as their own answers, and returns the parsed body on 200", async () => {
    stubFetch(() => jsonResponse(410, { error: "gone" }));
    expect(await confirmAttach(TOKEN)).toBe("invalid-or-expired");

    stubFetch(() => jsonResponse(409, { error: "conflict" }));
    expect(await confirmAttach(TOKEN)).toBe("conflict");

    stubFetch(() => jsonResponse(500, { error: "boom" }));
    expect(await confirmAttach(TOKEN)).toBeUndefined();

    stubFetch(() => jsonResponse(200, { merged: "yes" }));
    expect(await confirmAttach(TOKEN)).toBeUndefined();

    stubFetch(() => jsonResponse(200, { merged: true }));
    expect(await confirmAttach(TOKEN)).toEqual({ merged: true });
  });

  it("deleteAccount is the one write that reads its body back — an unparseable 200 is not a deletion", async () => {
    stubFetch(() => jsonResponse(200, { deleted: true }));
    expect(await deleteAccount()).toBe(true);

    stubFetch(() => jsonResponse(200, { deleted: false }));
    expect(
      await deleteAccount(),
      "the contract pins deleted to the literal true",
    ).toBe(false);

    stubFetch(() => jsonResponse(200, {}));
    expect(await deleteAccount()).toBe(false);

    stubFetch(() => jsonResponse(500, { error: "boom" }));
    expect(await deleteAccount()).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    expect(await deleteAccount()).toBe(false);
  });

  it("dismissAttachPrompt answers the status alone, and never reads the body", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { nonsense: true }));
    expect(await dismissAttachPrompt()).toBe(true);
    const response = await (
      fetchMock.mock.results[0] as { value: Promise<Response> }
    ).value;
    expect(response.bodyUsed, "the body is left unread").toBe(false);

    stubFetch(() => jsonResponse(500, { error: "boom" }));
    expect(await dismissAttachPrompt()).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    expect(await dismissAttachPrompt()).toBe(false);
  });
});
