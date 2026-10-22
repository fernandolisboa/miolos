import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TelemetrySection } from "../app/ajustes/telemetry-section";
import PrivacyPage from "../app/privacidade/page";
import {
  fetchTelemetrySending,
  setTelemetrySending,
} from "../src/account/telemetry-client";
import { messages, routes } from "../src/i18n";
import { jsonResponse } from "./fetch-stub";

const API_URL = "https://api.example.test";
const copy = messages.settings.telemetry;

vi.mock("../src/session/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/session/bootstrap")>()),
  ensureSession: () => Promise.resolve(),
}));

function stubTelemetry(
  initial: boolean,
  options: { failWrite?: boolean } = {},
) {
  let sending = initial;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/account/telemetry")) {
      if (options.failWrite) {
        return Promise.resolve(jsonResponse(500, { error: "internal" }));
      }
      sending = (JSON.parse(init?.body as string) as { sending: boolean })
        .sending;
    }
    return Promise.resolve(jsonResponse(200, { sending }));
  });
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

describe("the telemetry client calls parse their answers (T-WEB-S1020)", () => {
  it("reads and writes the strict {sending} body, and a refused or malformed answer is undefined", async () => {
    const fetchMock = stubTelemetry(true);
    expect(await fetchTelemetrySending()).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_URL}/account/telemetry/state`,
    );
    expect(await setTelemetrySending(false)).toBe(false);
    const [url, init] = fetchMock.mock.calls[1] ?? [];
    expect(url).toBe(`${API_URL}/account/telemetry`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ sending: false }));

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { sending: "no" }))),
    );
    expect(await fetchTelemetrySending()).toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(401, { error: "no-session" }))),
    );
    expect(await setTelemetrySending(true)).toBeUndefined();
  });
});

describe("the Medições de uso card in Ajustes (T-WEB-S1021)", () => {
  it("renders its heading and the policy link before any read, then the switch from the account's choice", async () => {
    stubTelemetry(true);
    const markup = renderToStaticMarkup(<TelemetrySection />);
    expect(markup).toContain(copy.heading);
    expect(markup).toContain(`href="${routes.privacy}"`);
    expect(markup).not.toContain('role="switch"');

    render(<TelemetrySection />);
    const toggle = await screen.findByRole("switch", { name: copy.toggle });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveTextContent(copy.on);
  });

  it("turns measurements off and on, holding still while the write is in flight", async () => {
    const fetchMock = stubTelemetry(true);
    render(<TelemetrySection />);
    const toggle = await screen.findByRole("switch", { name: copy.toggle });

    fireEvent.click(toggle);
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveTextContent(copy.busy);
    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-checked", "false");
    });
    expect(toggle).toHaveTextContent(copy.off);
    expect(toggle).toBeEnabled();

    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });
    expect(
      fetchMock.mock.calls
        .filter(([url]) => url.endsWith("/account/telemetry"))
        .map(([, init]) => init?.body),
    ).toEqual([
      JSON.stringify({ sending: false }),
      JSON.stringify({ sending: true }),
    ]);
  });

  it("a failed write says so and shows what the server holds; a failed read shows the neutral note and no switch", async () => {
    const fetchMock = stubTelemetry(true, { failWrite: true });
    render(<TelemetrySection />);
    const toggle = await screen.findByRole("switch", { name: copy.toggle });
    fireEvent.click(toggle);
    expect(await screen.findByRole("status")).toHaveTextContent(copy.error);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith("/state")),
    ).toHaveLength(2);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    const failed = render(<TelemetrySection />);
    await act(async () => {});
    expect(
      await within(failed.container).findByText(copy.unavailable),
    ).toBeInTheDocument();
    expect(within(failed.container).queryByRole("switch")).toBeNull();
  });
});

describe("the policy says where measurements are turned off (T-WEB-S1022)", () => {
  it("names Ajustes, says the switch acts from then on, and keeps the provider-copy channel", () => {
    const policy = renderToStaticMarkup(<PrivacyPage />);
    expect(policy).toContain(messages.privacy.collected.telemetry);
    expect(messages.privacy.collected.telemetry).toContain(
      messages.settings.title,
    );
    expect(messages.privacy.collected.telemetry).toContain("seguintes");
    expect(messages.privacy.collected.telemetry).toContain(
      "privacidade@miolos.app",
    );
  });
});
