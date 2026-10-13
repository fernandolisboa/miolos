import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminConfigSection } from "../app/admin/admin-config-section";
import AdminPage, { metadata } from "../app/admin/page";
import { messages } from "../src/i18n";

vi.mock("../src/session/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/session/bootstrap")>()),
  ensureSession: () => Promise.resolve(),
}));

const API_URL = "https://api.example.test";
const USER_ID = "0b6f3c1e-2d4a-4e8b-9f10-3a5c7d9e1f20";
const CONFIG = {
  bufferDepth: 7,
  attachStreakThreshold: 5,
  pushOptInStreakThreshold: 3,
};
const copy = messages.admin;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function serve(
  state: unknown,
  write: () => Promise<Response> = () => Promise.reject(new TypeError("down")),
) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? write()
      : Promise.resolve(jsonResponse(200, state)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function input(key: keyof typeof CONFIG): Promise<HTMLInputElement> {
  const field = await screen.findByLabelText(copy.keys[key].label);
  if (!(field instanceof HTMLInputElement)) {
    throw new Error(`${key} is not an input`);
  }
  return field;
}

function saveButton(key: keyof typeof CONFIG): HTMLElement {
  return screen.getByRole("button", {
    name: copy.config.saveAria(copy.keys[key].label),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/admin is a noindex static shell (T-WEB-S530)", () => {
  it("renders its marker, title and section heading with no fetch resolved, and is noindex", () => {
    const markup = renderToStaticMarkup(<AdminPage />);
    expect(markup).toContain('data-page="admin"');
    expect(markup).toContain(copy.title);
    expect(markup).toContain(copy.config.heading);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("a failed read shows the neutral fallback (T-WEB-S531)", () => {
  it("a non-OK answer or a malformed body lands on the unavailable line", async () => {
    for (const respond of [
      () => Promise.resolve(jsonResponse(401, { error: "no-session" })),
      () => Promise.resolve(jsonResponse(200, { userId: USER_ID })),
      () =>
        Promise.resolve(
          jsonResponse(200, { userId: USER_ID, config: { bufferDepth: 7 } }),
        ),
    ]) {
      vi.stubGlobal("fetch", vi.fn(respond));
      const view = render(<AdminConfigSection />);
      expect(
        await screen.findByText(copy.config.unavailable),
      ).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("a non-admin sees the refusal and their own id (T-WEB-S532)", () => {
  it("shows the id in a code element and no input", async () => {
    serve({ userId: USER_ID, config: null });
    render(<AdminConfigSection />);
    expect(await screen.findByText(copy.config.notAdmin)).toBeInTheDocument();
    expect(screen.getByText(USER_ID).tagName).toBe("CODE");
    expect(screen.queryAllByRole("spinbutton")).toEqual([]);
  });
});

describe("an admin sees one row per key, bounded by the schema (T-WEB-S533)", () => {
  it("each input carries its value, min, max and step, and the row names its range and default", async () => {
    serve({ userId: USER_ID, config: { ...CONFIG, bufferDepth: 12 } });
    render(<AdminConfigSection />);

    expect(await screen.findAllByRole("spinbutton")).toHaveLength(3);
    for (const [key, value, min, max, fallback] of [
      ["bufferDepth", "12", "1", "30", 7],
      ["attachStreakThreshold", "5", "1", "365", 5],
      ["pushOptInStreakThreshold", "3", "1", "365", 3],
    ] as const) {
      const field = await input(key);
      expect(field.value, key).toBe(value);
      expect(field.min, key).toBe(min);
      expect(field.max, key).toBe(max);
      expect(field.step, key).toBe("1");
      expect(
        screen.getByText(copy.config.range(Number(min), Number(max), fallback)),
      ).toBeInTheDocument();
    }
  });
});

describe("saving a row posts that key and redraws every row from the answer (T-WEB-S534)", () => {
  it("posts {key, value}, says saved, and every row shows the server's answer", async () => {
    const fetchMock = serve(
      { userId: USER_ID, config: { ...CONFIG, attachStreakThreshold: 9 } },
      () =>
        Promise.resolve(
          jsonResponse(200, {
            userId: USER_ID,
            config: { ...CONFIG, bufferDepth: 10 },
          }),
        ),
    );
    render(<AdminConfigSection />);

    fireEvent.change(await input("bufferDepth"), { target: { value: "10" } });
    fireEvent.click(saveButton("bufferDepth"));

    expect(await screen.findByText(copy.config.saved)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/admin/config`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ key: "bufferDepth", value: 10 }),
      }),
    );
    expect((await input("bufferDepth")).value).toBe("10");
    expect((await input("attachStreakThreshold")).value).toBe("5");
    expect(saveButton("bufferDepth")).toBeDisabled();
  });
});

describe("a failed save keeps the draft and says so (T-WEB-S535)", () => {
  it("a 403, a malformed answer or a network error leave the typed value in place", async () => {
    for (const write of [
      () => Promise.resolve(jsonResponse(403, { error: "not-admin" })),
      () => Promise.resolve(jsonResponse(200, { config: CONFIG })),
      () => Promise.reject(new TypeError("offline")),
    ]) {
      serve({ userId: USER_ID, config: CONFIG }, write);
      const view = render(<AdminConfigSection />);

      fireEvent.change(await input("pushOptInStreakThreshold"), {
        target: { value: "4" },
      });
      fireEvent.click(saveButton("pushOptInStreakThreshold"));

      expect(await screen.findByText(copy.config.failed)).toBeInTheDocument();
      expect((await input("pushOptInStreakThreshold")).value).toBe("4");
      expect(saveButton("pushOptInStreakThreshold")).toBeEnabled();
      view.unmount();
    }
  });
});

describe("Salvar is offered only for a changed, valid draft and holds still in flight (T-WEB-S536)", () => {
  it("is disabled while unchanged, empty, out of range or fractional, and while the write is pending", async () => {
    let finish: (response: Response) => void = () => undefined;
    serve(
      { userId: USER_ID, config: CONFIG },
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    render(<AdminConfigSection />);
    const field = await input("bufferDepth");

    expect(saveButton("bufferDepth")).toBeDisabled();
    for (const value of ["", "0", "31", "7.5"]) {
      fireEvent.change(field, { target: { value } });
      expect(saveButton("bufferDepth"), JSON.stringify(value)).toBeDisabled();
    }
    fireEvent.change(field, { target: { value: "30" } });
    expect(saveButton("bufferDepth")).toBeEnabled();

    fireEvent.click(saveButton("bufferDepth"));
    await waitFor(() => {
      expect(saveButton("bufferDepth")).toBeDisabled();
    });
    expect(field).toBeDisabled();
    finish(
      jsonResponse(200, {
        userId: USER_ID,
        config: { ...CONFIG, bufferDepth: 30 },
      }),
    );
    expect(await screen.findByText(copy.config.saved)).toBeInTheDocument();
    expect(field).toBeEnabled();
  });
});

describe("one save at a time, so an older answer never overwrites a newer one (T-WEB-S537)", () => {
  it("holds every row while any row's write is pending", async () => {
    let finish: (response: Response) => void = () => undefined;
    serve(
      { userId: USER_ID, config: CONFIG },
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    render(<AdminConfigSection />);
    const depth = await input("bufferDepth");
    const attach = await input("attachStreakThreshold");
    fireEvent.change(attach, { target: { value: "8" } });
    fireEvent.change(depth, { target: { value: "10" } });

    fireEvent.click(saveButton("bufferDepth"));
    await waitFor(() => {
      expect(saveButton("attachStreakThreshold")).toBeDisabled();
    });
    expect(attach).toBeDisabled();

    finish(
      jsonResponse(200, {
        userId: USER_ID,
        config: { ...CONFIG, bufferDepth: 10 },
      }),
    );
    await waitFor(() => {
      expect(saveButton("attachStreakThreshold")).toBeEnabled();
    });
    expect(attach.value).toBe("8");
  });
});
