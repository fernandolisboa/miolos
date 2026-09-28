import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleSection } from "../app/ajustes/google-section";
import PrivacyPage from "../app/privacidade/page";
import {
  fetchGoogleState,
  googleStartUrl,
  unlinkGoogle,
} from "../src/account/google-client";
import { messages } from "../src/i18n";

const API_URL = "https://api.example.test";
const copy = messages.settings.google;

vi.mock("../src/session/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/session/bootstrap")>()),
  ensureSession: () => Promise.resolve(),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubFetch(respond: (url: string) => Promise<Response>) {
  const fetchMock = vi.fn(respond);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubGoogleState(google: string, afterUnlink = "unlinked") {
  let current = google;
  return stubFetch((url) => {
    if (url.endsWith("/account/unlink-google")) {
      current = afterUnlink;
      return Promise.resolve(jsonResponse(200, { unlinked: true }));
    }
    return Promise.resolve(jsonResponse(200, { google: current }));
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  window.history.replaceState(null, "", "/ajustes");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the Google client calls parse their answers (T-WEB-S470)", () => {
  it("reads the state word, builds the start link, and unlinks on the literal answer or a 409 no-google", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(200, { google: "linked" })));
    expect(await fetchGoogleState()).toBe("linked");
    for (const body of [{ google: "yes" }, { google: "linked", id: "x" }]) {
      stubFetch(() => Promise.resolve(jsonResponse(200, body)));
      expect(await fetchGoogleState()).toBeUndefined();
    }

    expect(googleStartUrl()).toBe(`${API_URL}/auth/google/start`);

    const fetchMock = stubFetch(() =>
      Promise.resolve(jsonResponse(200, { unlinked: true })),
    );
    expect(await unlinkGoogle()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/account/unlink-google`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ confirm: true }),
      }),
    );
    stubFetch(() => Promise.resolve(jsonResponse(409, { error: "no-google" })));
    expect(await unlinkGoogle()).toBe(true);
    for (const respond of [
      () => Promise.resolve(jsonResponse(409, { error: "other" })),
      () => Promise.resolve(jsonResponse(500, { error: "internal" })),
      () => Promise.reject(new TypeError("offline")),
    ]) {
      stubFetch(respond);
      expect(await unlinkGoogle()).toBe(false);
    }
  });
});

describe("the Conta Google card in Ajustes (T-WEB-S471)", () => {
  it("is absent while Google is unavailable or the read fails", async () => {
    const fetchMock = stubGoogleState("unavailable");
    const { container, unmount } = render(<GoogleSection />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
    unmount();

    const failingFetch = stubFetch(() =>
      Promise.reject(new TypeError("offline")),
    );
    const failed = render(<GoogleSection />);
    await waitFor(() => {
      expect(failingFetch).toHaveBeenCalled();
    });
    await act(async () => {});
    expect(failed.container).toBeEmptyDOMElement();
  });

  it("unlinked, it explains what Google gives us and links to the start route", async () => {
    stubGoogleState("unlinked");
    render(<GoogleSection />);
    const start = await screen.findByRole("link", { name: copy.start });
    expect(start).toHaveAttribute("href", `${API_URL}/auth/google/start`);
    expect(screen.getByText(copy.lead)).toBeInTheDocument();
    expect(screen.getByText(copy.mergeNote)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: copy.heading }),
    ).toBeInTheDocument();
  });
});

describe("the linked card and its unlink (T-WEB-S473)", () => {
  it("says so and unlinks only after the confirm, then offers the sign-in again", async () => {
    const fetchMock = stubGoogleState("linked");
    render(<GoogleSection />);
    expect(await screen.findByText(copy.linked)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: copy.start })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: copy.unlink.start }));
    expect(screen.getByText(copy.unlink.confirmBody)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.unlink.cancel }));
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith("unlink-google")),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: copy.unlink.start }));
    fireEvent.click(screen.getByRole("button", { name: copy.unlink.confirm }));
    expect(await screen.findByText(copy.unlink.done)).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: copy.start }),
    ).toBeInTheDocument();
  });

  it("offers no sign-in after the unlink when the server says Google is unavailable", async () => {
    const fetchMock = stubGoogleState("linked", "unavailable");
    render(<GoogleSection />);
    fireEvent.click(
      await screen.findByRole("button", { name: copy.unlink.start }),
    );
    fireEvent.click(screen.getByRole("button", { name: copy.unlink.confirm }));
    expect(await screen.findByText(copy.unlink.done)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    await act(async () => {});
    expect(screen.queryByRole("link", { name: copy.start })).toBeNull();
    expect(screen.queryByText(copy.lead)).toBeNull();
    expect(screen.getByText(copy.unlink.done)).toBeInTheDocument();
  });
});

describe("the sign-in outcome notice (T-WEB-S472)", () => {
  it.each(["ok", "switched", "failed", "conflict"] as const)(
    "?google=%s shows its sentence once and leaves the address clean",
    async (outcome) => {
      window.history.replaceState(
        null,
        "",
        `/ajustes?tema=x&google=${outcome}`,
      );
      stubGoogleState(outcome === "failed" ? "unlinked" : "linked");
      render(<GoogleSection />);
      expect(
        await screen.findByText(copy.outcome[outcome]),
      ).toBeInTheDocument();
      expect(window.location.pathname + window.location.search).toBe(
        "/ajustes?tema=x",
      );
    },
  );

  it("shows even when the state read fails", async () => {
    window.history.replaceState(null, "", "/ajustes?google=failed");
    stubFetch(() => Promise.reject(new TypeError("offline")));
    render(<GoogleSection />);
    expect(await screen.findByText(copy.outcome.failed)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: copy.start })).toBeNull();
  });

  it("hydrates over the server's empty markup without a mismatch", async () => {
    stubGoogleState("linked");
    const container = document.createElement("div");
    container.innerHTML = renderToString(<GoogleSection />);
    window.history.replaceState(null, "", "/ajustes?google=ok");
    document.body.append(container);
    const recoverable = vi.fn();
    let root: Root | undefined;
    act(() => {
      root = hydrateRoot(container, <GoogleSection />, {
        onRecoverableError: recoverable,
      });
    });
    expect(await screen.findByText(copy.outcome.ok)).toBeInTheDocument();
    expect(recoverable).not.toHaveBeenCalled();
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("an unknown word shows nothing and is still cleaned away", async () => {
    window.history.replaceState(null, "", "/ajustes?google=<b>hi</b>");
    stubGoogleState("unlinked");
    render(<GoogleSection />);
    await screen.findByRole("link", { name: copy.start });
    for (const sentence of Object.values(copy.outcome)) {
      expect(screen.queryByText(sentence)).toBeNull();
    }
    expect(window.location.search).toBe("");
  });
});

describe("the policy names the Google identifier (T-WEB-S474)", () => {
  it("lists what Google gives us, what it is for, and names Google as a way in", () => {
    const policy = renderToStaticMarkup(<PrivacyPage />);
    expect(policy).toContain(messages.privacy.collected.google);
    expect(policy).toContain(messages.privacy.why.google);
    expect(messages.privacy.collected.google).toContain(
      messages.settings.title,
    );
    expect(messages.privacy.noPassword.body).toContain("Google");
  });
});
