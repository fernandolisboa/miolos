import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetry = vi.hoisted(() => ({ markSessionReady: vi.fn() }));
vi.mock("../src/telemetry/client", () => telemetry);

// The fire-once guard is module state, so every test imports a fresh copy.
async function freshSessionBootstrap() {
  vi.resetModules();
  const { SessionBootstrap } =
    await import("../src/components/session-bootstrap");
  return SessionBootstrap;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  telemetry.markSessionReady.mockClear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
});

describe("SessionBootstrap", () => {
  it("renders nothing and fires exactly one credentialed POST to /session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ userId: crypto.randomUUID(), created: true }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const SessionBootstrap = await freshSessionBootstrap();
    const { container } = render(<SessionBootstrap />);
    await flushMicrotasks();

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/session", {
      method: "POST",
      credentials: "include",
    });
  });

  it("still fires only once under StrictMode double effects and re-mounts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ userId: crypto.randomUUID(), created: true }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const SessionBootstrap = await freshSessionBootstrap();
    const first = render(
      <StrictMode>
        <SessionBootstrap />
      </StrictMode>,
    );
    first.unmount();
    render(
      <StrictMode>
        <SessionBootstrap />
      </StrictMode>,
    );
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips the fetch and logs loudly when NEXT_PUBLIC_API_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const SessionBootstrap = await freshSessionBootstrap();
    render(<SessionBootstrap />);
    await flushMicrotasks();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("swallows a network failure: an offline first paint must not break the page", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const SessionBootstrap = await freshSessionBootstrap();
    expect(() => render(<SessionBootstrap />)).not.toThrow();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("T-WEB-S355: a FAILED mint opens the telemetry gate too, so buffered starts are never held forever", async () => {
    for (const mint of [
      () => Promise.reject(new TypeError("offline")),
      () => Promise.resolve(new Response(null, { status: 500 })),
      () => Promise.resolve(new Response("not json", { status: 200 })),
    ]) {
      telemetry.markSessionReady.mockClear();
      vi.stubGlobal("fetch", vi.fn(mint));

      const SessionBootstrap = await freshSessionBootstrap();
      render(<SessionBootstrap />);
      for (let round = 0; round < 20; round += 1) {
        await Promise.resolve();
      }

      expect(telemetry.markSessionReady).toHaveBeenCalledTimes(1);
    }
  });
});
