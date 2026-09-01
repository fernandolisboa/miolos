import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchOnboardingState,
  markOnboardingSeen,
} from "../src/onboarding/onboarding-client";

const API_URL = "https://api.example.test";

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

describe("onboarding-client (T-WEB-S362)", () => {
  it("logs loudly and fetches nothing when NEXT_PUBLIC_API_URL is unset — both calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchOnboardingState()).toBeUndefined();
    expect(await markOnboardingSeen()).toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      "NEXT_PUBLIC_API_URL is unset: onboarding calls skipped, the card stays absent",
      "NEXT_PUBLIC_API_URL is unset: onboarding calls skipped, the card stays absent",
    ]);
  });

  it("the read is a credentialed bare GET and the write is a credentialed JSON POST", async () => {
    const reads = stubFetch(() => jsonResponse(200, { show: true }));
    await fetchOnboardingState();
    const [readUrl, readInit] = reads.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(readUrl).toBe(`${API_URL}/onboarding/state`);
    expect(readInit).toEqual({ credentials: "include" });

    const writes = stubFetch(() => jsonResponse(200, { seen: true }));
    await markOnboardingSeen();
    const [writeUrl, writeInit] = writes.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(writeUrl).toBe(`${API_URL}/onboarding/seen`);
    expect(writeInit.method).toBe("POST");
    expect(writeInit.credentials).toBe("include");
    expect(writeInit.headers).toEqual({ "Content-Type": "application/json" });
    expect(writeInit.body).toBe("{}");
  });

  it("fetchOnboardingState answers undefined on a non-ok status, an unparseable body and a throw alike", async () => {
    stubFetch(() => jsonResponse(500, { show: true }));
    expect(await fetchOnboardingState()).toBeUndefined();

    stubFetch(() => jsonResponse(200, { show: "yes" }));
    expect(await fetchOnboardingState()).toBeUndefined();

    stubFetch(() => jsonResponse(200, { show: true, extra: 1 }));
    expect(
      await fetchOnboardingState(),
      "the contract is strict",
    ).toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    expect(await fetchOnboardingState()).toBeUndefined();

    stubFetch(() => jsonResponse(200, { show: false }));
    expect(await fetchOnboardingState()).toEqual({ show: false });
  });

  it("markOnboardingSeen answers the status alone, and never reads the body", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { nonsense: true }));
    expect(await markOnboardingSeen()).toBe(true);
    const response = await (
      fetchMock.mock.results[0] as { value: Promise<Response> }
    ).value;
    expect(response.bodyUsed, "the body is left unread").toBe(false);

    stubFetch(() => jsonResponse(500, { error: "boom" }));
    expect(await markOnboardingSeen()).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    expect(await markOnboardingSeen()).toBe(false);
  });
});
