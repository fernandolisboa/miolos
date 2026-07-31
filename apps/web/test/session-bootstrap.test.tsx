import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("swallows a network failure: an offline first paint must not break the page", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const SessionBootstrap = await freshSessionBootstrap();
    expect(() => render(<SessionBootstrap />)).not.toThrow();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
