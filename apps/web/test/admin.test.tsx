import type { AdminMember } from "@miolos/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminConfigSection } from "../app/admin/admin-config-section";
import adminStyles from "../app/admin/admin.module.css";
import AdminPage, { metadata } from "../app/admin/page";
import settingsStyles from "../app/ajustes/page.module.css";
import { messages } from "../src/i18n";
import { bodyOf, decl, stylesheet } from "./css-source";

vi.mock("../src/session/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/session/bootstrap")>()),
  ensureSession: () => Promise.resolve(),
}));

const API_URL = "https://api.example.test";
const EMAIL = "ana@example.com";
const CONFIG = {
  bufferDepth: 7,
  attachStreakThreshold: 5,
  pushOptInStreakThreshold: 3,
  freeHintsPerPuzzle: 3,
};
const admin = (config: typeof CONFIG = CONFIG) => ({
  role: "admin",
  email: EMAIL,
  config,
});
const MEMBERS = [
  { email: EMAIL, role: "superuser" },
  { email: "bia@example.com", role: "admin" },
] as const;
const superuser = (members: readonly AdminMember[] = MEMBERS) => ({
  role: "superuser",
  email: EMAIL,
  config: CONFIG,
  members,
});
const copy = messages.admin;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function serve(
  state: unknown,
  write: () => Promise<Response> = () => Promise.reject(new TypeError("down")),
) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    init?.method === undefined
      ? Promise.resolve(jsonResponse(200, state))
      : write(),
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

function pending(): {
  write: () => Promise<Response>;
  finish: (response: Response) => void;
} {
  let finish: (response: Response) => void = () => undefined;
  return {
    write: () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    finish: (response) => {
      finish(response);
    },
  };
}

function roleSelect(email: string): HTMLSelectElement {
  const select = screen.getByRole("combobox", {
    name: copy.members.roleAria(email),
  });
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`${email} has no role select`);
  }
  return select;
}

function removeButton(email: string): HTMLElement {
  return screen.getByRole("button", { name: copy.members.removeAria(email) });
}

function addButton(): HTMLElement {
  return screen.getByRole("button", { name: copy.members.add });
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

describe("/admin stacks its cards in the shared sections grid at the old card measure (T-WEB-S801)", () => {
  it("the config card sits in a sections grid that admin holds to 60ch on the wide Ajustes sheet", () => {
    document.body.innerHTML = renderToStaticMarkup(<AdminPage />);
    const wrapper = document.querySelector(
      '[aria-labelledby="admin-config-heading"]',
    )?.parentElement;
    expect(wrapper?.classList.contains(String(settingsStyles.sections))).toBe(
      true,
    );
    expect(wrapper?.classList.contains(String(adminStyles.sections))).toBe(
      true,
    );
    expect(
      decl(
        bodyOf(stylesheet("app/admin/admin.module.css"), ".sections"),
        "max-width",
      ),
    ).toBe("60ch");
    document.body.innerHTML = "";
  });
});

describe("a failed read shows the neutral fallback (T-WEB-S531)", () => {
  it("a non-OK answer or a malformed body lands on the unavailable line", async () => {
    for (const respond of [
      () => Promise.resolve(jsonResponse(401, { error: "no-session" })),
      () => Promise.resolve(jsonResponse(200, { role: "admin", email: EMAIL })),
      () =>
        Promise.resolve(
          jsonResponse(200, {
            role: "admin",
            email: EMAIL,
            config: { bufferDepth: 7 },
          }),
        ),
      () =>
        Promise.resolve(
          jsonResponse(200, {
            role: "superuser",
            email: EMAIL,
            config: CONFIG,
          }),
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

describe("a non-member sees the refusal and their attached email, or the way to attach one (T-WEB-S532)", () => {
  it("shows the email in a code element and no input", async () => {
    serve({ role: "none", email: "zeca@example.com" });
    render(<AdminConfigSection />);
    expect(await screen.findByText(copy.config.notAdmin)).toBeInTheDocument();
    expect(screen.getByText("zeca@example.com").tagName).toBe("CODE");
    expect(screen.getByText(copy.config.emailLabel)).toBeInTheDocument();
    expect(screen.queryAllByRole("spinbutton")).toEqual([]);
    expect(screen.queryByText(copy.members.heading)).toBeNull();
  });

  it("with no email attached, says so and links to Ajustes", async () => {
    serve({ role: "none", email: null });
    render(<AdminConfigSection />);
    expect(await screen.findByText(copy.config.noEmail)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.settings.title }),
    ).toHaveAttribute("href", "/ajustes");
    expect(screen.queryByText(copy.config.emailLabel)).toBeNull();
    expect(screen.queryAllByRole("spinbutton")).toEqual([]);
  });
});

describe("an admin sees one row per key, bounded by the schema (T-WEB-S533)", () => {
  it("each input carries its value, min, max and step, and the row names its range and default", async () => {
    serve(admin({ ...CONFIG, bufferDepth: 12 }));
    render(<AdminConfigSection />);

    expect(await screen.findAllByRole("spinbutton")).toHaveLength(4);
    for (const [key, value, min, max, fallback] of [
      ["bufferDepth", "12", "1", "30", 7],
      ["attachStreakThreshold", "5", "1", "365", 5],
      ["pushOptInStreakThreshold", "3", "1", "365", 3],
      ["freeHintsPerPuzzle", "3", "1", "9", 3],
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
      admin({ ...CONFIG, attachStreakThreshold: 9 }),
      () =>
        Promise.resolve(
          jsonResponse(200, admin({ ...CONFIG, bufferDepth: 10 })),
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
      serve(admin(), write);
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
    const save = pending();
    serve(admin(), save.write);
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
    save.finish(jsonResponse(200, admin({ ...CONFIG, bufferDepth: 30 })));
    expect(await screen.findByText(copy.config.saved)).toBeInTheDocument();
    expect(field).toBeEnabled();
  });
});

describe("one save at a time, so an older answer never overwrites a newer one (T-WEB-S537)", () => {
  it("holds every row while any row's write is pending", async () => {
    const save = pending();
    serve(admin(), save.write);
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

    save.finish(jsonResponse(200, admin({ ...CONFIG, bufferDepth: 10 })));
    await waitFor(() => {
      expect(saveButton("attachStreakThreshold")).toBeEnabled();
    });
    expect(attach.value).toBe("8");
  });

  it("holds the members card during a config save, and the config rows during a member write", async () => {
    const save = pending();
    serve(superuser(), save.write);
    render(<AdminConfigSection />);
    fireEvent.change(await input("bufferDepth"), { target: { value: "10" } });
    fireEvent.click(saveButton("bufferDepth"));
    await waitFor(() => {
      expect(roleSelect("bia@example.com")).toBeDisabled();
    });
    expect(removeButton("bia@example.com")).toBeDisabled();
    save.finish(jsonResponse(200, superuser()));
    await waitFor(() => {
      expect(roleSelect("bia@example.com")).toBeEnabled();
    });

    const write = pending();
    serve(superuser(), write.write);
    fireEvent.click(removeButton("bia@example.com"));
    await waitFor(() => {
      expect(roleSelect("bia@example.com")).toBeDisabled();
    });
    expect(await input("bufferDepth")).toBeDisabled();
    write.finish(jsonResponse(200, superuser()));
    await waitFor(async () => {
      expect(await input("bufferDepth")).toBeEnabled();
    });
  });
});

describe("only a superuser sees who administers (T-WEB-S557)", () => {
  it("an admin sees the config and no members card; a superuser sees every member with its role", async () => {
    serve(admin());
    const view = render(<AdminConfigSection />);
    expect(await screen.findAllByRole("spinbutton")).toHaveLength(4);
    expect(screen.queryByText(copy.members.heading)).toBeNull();
    expect(screen.queryByText("bia@example.com")).toBeNull();
    view.unmount();

    serve(superuser());
    render(<AdminConfigSection />);
    expect(
      await screen.findByRole("heading", { name: copy.members.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.members.lead)).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(4);
    expect(roleSelect(EMAIL).value).toBe("superuser");
    expect(roleSelect("bia@example.com").value).toBe("admin");
    expect(
      Array.from(roleSelect(EMAIL).options, (option) => [
        option.value,
        option.text,
      ]),
    ).toEqual([
      ["superuser", copy.members.roles.superuser],
      ["admin", copy.members.roles.admin],
    ]);
    expect(screen.getByLabelText(copy.members.emailLabel)).toHaveValue("");
    expect(screen.getByLabelText(copy.members.roleLabel)).toHaveValue("admin");
  });
});

describe("Adicionar posts a valid email with its role and redraws (T-WEB-S558)", () => {
  it("is offered only for a valid email, posts {email, role}, clears the draft and redraws the list", async () => {
    const answered = superuser([
      ...MEMBERS,
      { email: "caio@example.com", role: "superuser" },
    ]);
    const fetchMock = serve(superuser(), () =>
      Promise.resolve(jsonResponse(200, answered)),
    );
    render(<AdminConfigSection />);
    const email = await screen.findByLabelText(copy.members.emailLabel);

    expect(addButton()).toBeDisabled();
    for (const value of [
      "",
      "caio",
      "caio@",
      `${"a".repeat(243)}@example.com`,
    ]) {
      fireEvent.change(email, { target: { value } });
      expect(addButton(), value).toBeDisabled();
    }
    fireEvent.change(email, { target: { value: " Caio@Example.com " } });
    fireEvent.change(screen.getByLabelText(copy.members.roleLabel), {
      target: { value: "superuser" },
    });
    expect(addButton()).toBeEnabled();
    fireEvent.click(addButton());

    expect(await screen.findByText(copy.config.saved)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/admin/members`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "caio@example.com", role: "superuser" }),
      }),
    );
    expect(roleSelect("caio@example.com").value).toBe("superuser");
    expect(email).toHaveValue("");
    expect(screen.getByLabelText(copy.members.roleLabel)).toHaveValue("admin");
  });

  it("a failed add keeps the draft and says so", async () => {
    for (const write of [
      () => Promise.resolve(jsonResponse(403, { error: "not-superuser" })),
      () => Promise.resolve(jsonResponse(200, { members: [] })),
      () => Promise.reject(new TypeError("offline")),
    ]) {
      serve(superuser(), write);
      const view = render(<AdminConfigSection />);
      const email = await screen.findByLabelText(copy.members.emailLabel);
      fireEvent.change(email, { target: { value: "caio@example.com" } });
      fireEvent.click(addButton());

      expect(await screen.findByText(copy.config.failed)).toBeInTheDocument();
      expect(email).toHaveValue("caio@example.com");
      expect(addButton()).toBeEnabled();
      expect(screen.queryByText("caio@example.com")).toBeNull();
      view.unmount();
    }
  });
});

describe("a member's role changes from its select and Remover deletes it (T-WEB-S559)", () => {
  it("a role change posts the upsert and Remover sends a DELETE, each redrawing from the answer", async () => {
    let answer: unknown = superuser([
      { email: EMAIL, role: "superuser" },
      { email: "bia@example.com", role: "superuser" },
    ]);
    const fetchMock = serve(superuser(), () =>
      Promise.resolve(jsonResponse(200, answer)),
    );
    render(<AdminConfigSection />);

    fireEvent.change(await waitFor(() => roleSelect("bia@example.com")), {
      target: { value: "superuser" },
    });
    expect(await screen.findByText(copy.config.saved)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_URL}/admin/members`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "bia@example.com", role: "superuser" }),
      }),
    );
    expect(roleSelect("bia@example.com").value).toBe("superuser");

    answer = superuser([{ email: EMAIL, role: "superuser" }]);
    fireEvent.click(removeButton("bia@example.com"));
    await waitFor(() => {
      expect(screen.queryByText("bia@example.com")).toBeNull();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_URL}/admin/members`,
      expect.objectContaining({
        method: "DELETE",
        credentials: "include",
        body: JSON.stringify({ email: "bia@example.com" }),
      }),
    );
  });

  it("a role change answered 409 says failed and leaves the list as the server last answered", async () => {
    serve(
      superuser([
        { email: EMAIL, role: "superuser" },
        { email: "bia@example.com", role: "superuser" },
      ]),
      () => Promise.resolve(jsonResponse(409, { error: "last-superuser" })),
    );
    render(<AdminConfigSection />);

    fireEvent.change(await waitFor(() => roleSelect("bia@example.com")), {
      target: { value: "admin" },
    });
    expect(await screen.findByText(copy.config.failed)).toBeInTheDocument();
    expect(roleSelect("bia@example.com").value).toBe("superuser");
  });

  it("a Remover answered 409 says failed and keeps the member", async () => {
    const fetchMock = serve(
      superuser([
        { email: EMAIL, role: "superuser" },
        { email: "bia@example.com", role: "superuser" },
      ]),
      () => Promise.resolve(jsonResponse(409, { error: "last-superuser" })),
    );
    render(<AdminConfigSection />);

    fireEvent.click(await waitFor(() => removeButton("bia@example.com")));
    expect(await screen.findByText(copy.config.failed)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${API_URL}/admin/members`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(screen.getByText("bia@example.com")).toBeInTheDocument();
  });
});

describe("the only superuser cannot be changed or removed from the page (T-WEB-S560)", () => {
  it("disables that row's select and Remover with a note, and enables them beside a second superuser", async () => {
    serve(superuser());
    const view = render(<AdminConfigSection />);
    await waitFor(() => {
      expect(roleSelect(EMAIL)).toBeDisabled();
    });
    expect(removeButton(EMAIL)).toBeDisabled();
    expect(screen.getByText(copy.members.lastSuperuser)).toBeInTheDocument();
    expect(roleSelect("bia@example.com")).toBeEnabled();
    expect(removeButton("bia@example.com")).toBeEnabled();
    view.unmount();

    serve(
      superuser([
        { email: EMAIL, role: "superuser" },
        { email: "bia@example.com", role: "superuser" },
      ]),
    );
    render(<AdminConfigSection />);
    await waitFor(() => {
      expect(roleSelect(EMAIL)).toBeEnabled();
    });
    expect(removeButton(EMAIL)).toBeEnabled();
    expect(roleSelect("bia@example.com")).toBeEnabled();
    expect(screen.queryByText(copy.members.lastSuperuser)).toBeNull();
  });
});
