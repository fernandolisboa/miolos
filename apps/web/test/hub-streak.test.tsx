import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HubStreak } from "../app/hub-streak";
import { messages } from "../src/i18n";

const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(
  factory: () => Response | Promise<Response>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() => Promise.resolve(factory()));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("HubStreak (T-WEB-S125)", () => {
  it("renders the zero state before the fetch resolves", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    render(<HubStreak />);

    expect(
      screen.getByLabelText(messages.hoje.streak.aria(0)),
    ).toHaveTextContent("0");
    expect(screen.getByText(messages.hoje.streak.label)).toBeInTheDocument();
  });

  it("hydrates the server value in: numeral and aria both move to 12", async () => {
    stubFetch(() =>
      jsonResponse(200, { date: "2026-07-31", streak: 12, todayCounts: true }),
    );

    render(<HubStreak />);

    const stamp = await screen.findByLabelText(messages.hoje.streak.aria(12));
    expect(stamp).toHaveTextContent("12");
    expect(screen.getByText(messages.hoje.streak.label)).toBeInTheDocument();
  });

  it("keeps the zero state on a 401 — the anonymous answer, not an error", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(401, { error: "no-session" }),
    );

    render(<HubStreak />);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(
      await screen.findByLabelText(messages.hoje.streak.aria(0)),
    ).toBeInTheDocument();
  });

  it("keeps the zero state on a body the strict contract refuses", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        date: "2026-07-31",
        streak: 3,
        todayCounts: false,
        extra: true,
      }),
    );

    render(<HubStreak />);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(
      await screen.findByLabelText(messages.hoje.streak.aria(0)),
    ).toBeInTheDocument();
  });

  it("sends exactly one credentialed GET to /streak", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, { date: "2026-07-31", streak: 1, todayCounts: true }),
    );

    render(<HubStreak />);
    await screen.findByLabelText(messages.hoje.streak.aria(1));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/streak", {
      credentials: "include",
    });
  });
});
