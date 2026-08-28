import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetry = vi.hoisted(() => ({ markSessionReady: vi.fn() }));
vi.mock("../src/telemetry/client", () => telemetry);

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

  it("T-WEB-S355: the telemetry gate opens once the mint SETTLES, however it settles, so buffered starts are never held forever", async () => {
    const settlings = [
      ["a rejecting fetch", () => Promise.reject(new TypeError("offline"))],
      ["a 500", () => Promise.resolve(new Response(null, { status: 500 }))],
      [
        "a 200 whose body the contract refuses",
        () => Promise.resolve(new Response("not json", { status: 200 })),
      ],
      [
        "a 200 the contract accepts",
        () =>
          Promise.resolve(
            new Response(
              JSON.stringify({ userId: crypto.randomUUID(), created: true }),
            ),
          ),
      ],
    ] as const;

    for (const [label, mint] of settlings) {
      telemetry.markSessionReady.mockClear();
      vi.stubGlobal("fetch", vi.fn(mint));

      const SessionBootstrap = await freshSessionBootstrap();
      render(<SessionBootstrap />);
      // Awaiting the module's own promise rather than counting microtasks:
      // the effect has already called it, so this is a barrier, not a hope.
      const { ensureSession } = await import("../src/session/bootstrap");
      await ensureSession();

      expect(telemetry.markSessionReady, label).toHaveBeenCalledTimes(1);
    }
  });

  it("opens the gate with no API url too — nothing is minted, and nothing may buffer forever", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const SessionBootstrap = await freshSessionBootstrap();
    render(<SessionBootstrap />);
    const { ensureSession } = await import("../src/session/bootstrap");
    await ensureSession();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(telemetry.markSessionReady).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
