import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HubOnboarding } from "../app/hub-onboarding";
import HojePage from "../app/page";
import { messages, playRoutes, routes } from "../src/i18n";
import { bodyOf, decl, stylesheet } from "./css-source";

const clientMock = vi.hoisted(() => ({
  fetchOnboardingState: vi.fn<() => Promise<{ show: boolean } | undefined>>(),
  markOnboardingSeen: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("../src/onboarding/onboarding-client", () => clientMock);

const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

beforeEach(() => {
  clientMock.fetchOnboardingState.mockReset();
  clientMock.markOnboardingSeen.mockClear();
  bootstrapMock.ensureSession.mockReset();
  bootstrapMock.ensureSession.mockImplementation(() => Promise.resolve());
  clientMock.fetchOnboardingState.mockResolvedValue({ show: true });
});

async function renderShownCard() {
  render(<HubOnboarding />);
  return await screen.findByText(messages.onboarding.invitation);
}

describe("HubOnboarding first-paint contract (T-WEB-S247)", () => {
  it("the server render is EMPTY — no onboarding markup exists before hydration, so T-WEB-S17/S127's no-fetch-at-render contract is untouched", () => {
    expect(renderToStaticMarkup(<HubOnboarding />)).toBe("");

    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();
    expect(clientMock.fetchOnboardingState).not.toHaveBeenCalled();
  });
});

describe("HubOnboarding absent states (T-WEB-S249)", () => {
  it("unresolved, settled-without-a-value and show:false all render nothing — an unreachable server never nags — with the positive control beside them", async () => {
    clientMock.fetchOnboardingState.mockReturnValue(
      new Promise(() => undefined),
    );
    const unresolved = render(<HubOnboarding />);
    await waitFor(() => {
      expect(bootstrapMock.ensureSession).toHaveBeenCalled();
    });
    expect(unresolved.container.innerHTML).toBe("");
    unresolved.unmount();

    clientMock.fetchOnboardingState.mockResolvedValue(undefined);
    const failed = render(<HubOnboarding />);
    await waitFor(() => {
      expect(clientMock.fetchOnboardingState).toHaveBeenCalled();
    });
    expect(failed.container.innerHTML).toBe("");
    failed.unmount();

    clientMock.fetchOnboardingState.mockResolvedValue({ show: false });
    const seen = render(<HubOnboarding />);
    await waitFor(() => {
      expect(clientMock.fetchOnboardingState).toHaveBeenCalled();
    });
    expect(seen.container.innerHTML).toBe("");
    seen.unmount();

    clientMock.fetchOnboardingState.mockResolvedValue({ show: true });
    await renderShownCard();
  });
});

describe("HubOnboarding awaits the mint before it reads (T-WEB-S250)", () => {
  it("the state fetch is NOT issued until ensureSession resolves — the first-visit 401 race of plan 057 §1.3 stays closed", async () => {
    let releaseMint = (): void => undefined;
    bootstrapMock.ensureSession.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseMint = resolve;
      }),
    );

    render(<HubOnboarding />);
    await waitFor(() => {
      expect(bootstrapMock.ensureSession).toHaveBeenCalled();
    });

    expect(clientMock.fetchOnboardingState).not.toHaveBeenCalled();

    releaseMint();
    await screen.findByText(messages.onboarding.invitation);
    expect(clientMock.fetchOnboardingState).toHaveBeenCalledTimes(1);
  });
});

describe("HubOnboarding dismissal (T-WEB-S251)", () => {
  it("'Entendi' removes the card instantly and posts the acknowledgement exactly once — fire-and-forget, nothing awaited", async () => {
    await renderShownCard();

    fireEvent.click(
      screen.getByRole("button", { name: messages.onboarding.dismiss }),
    );
    expect(clientMock.markOnboardingSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(messages.onboarding.invitation)).toBeNull();
  });
});

describe("HubOnboarding copy is externalised (T-WEB-S252)", () => {
  it("every rendered string is messages.onboarding.*, and the component source carries no pt-BR string literal", async () => {
    await renderShownCard();
    for (const line of [
      messages.onboarding.lead,
      messages.onboarding.rollover,
      messages.onboarding.noAccount,
    ]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: messages.onboarding.dismiss }),
    ).toBeInTheDocument();

    const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const source = readFileSync(join(webRoot, "app/hub-onboarding.tsx"), "utf8")
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");

    expect(source).not.toMatch(/[À-ÖØ-öø-ÿ]/);
    for (const line of Object.values(messages.onboarding)) {
      expect(source).not.toContain(line);
    }
  });
});

describe("HubOnboarding reduced motion (T-WEB-S253)", () => {
  it("the reduce block stands down the transition and PRESERVES the static rotation — the card simply is where it is going to be", () => {
    const css = stylesheet("app/hub-onboarding.module.css");
    const reduce = bodyOf(css, "@media (prefers-reduced-motion: reduce)");
    expect(decl(reduce, "transition")).toBe("none");
    expect(decl(reduce, "animation")).toBe("none");
    expect(decl(reduce, "opacity")).toBe("1");

    expect(decl(reduce, "transform")).toBe("rotate(-0.3deg)");
  });
});

describe("HubOnboarding settle names no layout property (T-WEB-S254)", () => {
  it("the card's transition names ONLY opacity and transform, and the module declares no @keyframes", () => {
    const css = stylesheet("app/hub-onboarding.module.css");
    const card = bodyOf(css, ".intro");
    const transition = decl(card, "transition");
    expect(transition).toBeDefined();

    for (const item of (transition ?? "").split(",")) {
      expect(item.trim()).toMatch(/^(opacity|transform)\s/);
    }
    expect(css).not.toContain("@keyframes");

    expect(css).toContain("@starting-style");
  });
});

describe("HubOnboarding landmark and accessible name (T-WEB-S255)", () => {
  it("the card is a <section> named by its OWN rendered <h2> via aria-labelledby — visible text, never an aria-label that can drift", async () => {
    await renderShownCard();

    const region = screen.getByRole("region", {
      name: messages.onboarding.invitation,
    });
    expect(region.tagName).toBe("SECTION");
    const labelledBy = region.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(region).not.toHaveAttribute("aria-label");

    const heading = screen.getByRole("heading", {
      level: 2,
      name: messages.onboarding.invitation,
    });
    expect(heading.id).toBe(labelledBy);
  });
});

describe("HubOnboarding is a full-width band, not a half-width note (T-WEB-S303)", () => {
  it("the desktop card declares no width cap and composes two columns, the mobile block returns it to block flow, and the rotation is ONE angle at every site", () => {
    const css = stylesheet("app/hub-onboarding.module.css");
    const card = bodyOf(css, ".intro");

    expect(decl(card, "max-width")).toBeUndefined();
    expect(decl(card, "width")).toBeUndefined();

    expect(decl(card, "display")).toBe("grid");
    expect(decl(card, "grid-template-columns")).toBe(
      "minmax(0, 2fr) minmax(0, 3fr)",
    );

    const mobile = bodyOf(css, "@media (max-width: 768px)");
    const mobileCard = bodyOf(mobile, ".intro");
    expect(decl(mobileCard, "display")).toBe("block");

    expect(decl(bodyOf(css, ".body"), "max-width")).toBe("512px");
    expect(decl(bodyOf(mobile, ".body"), "max-width")).toBeUndefined();

    expect(decl(card, "transform")).toBe("rotate(-0.3deg)");
    const starting = bodyOf(css, "@starting-style");
    expect(decl(bodyOf(starting, ".intro"), "transform")).toBe(
      "rotate(-0.3deg) translateY(2px)",
    );
    expect(decl(mobileCard, "transform")).toBeUndefined();
  });
});

describe("the hub with the card never blocks play (T-WEB-S248)", () => {
  it("all four game links PRECEDE the card in document order, nothing is modal, and dismiss moves focus to the first game card's link — never <body>", async () => {
    render(<HojePage />);
    const card = await screen.findByText(messages.onboarding.invitation);

    for (const route of Object.values(playRoutes)) {
      const link = document.querySelector(`a[href="${route}"]`);
      expect(link, route).not.toBeNull();
      expect(
        link !== null &&
          link.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${route} precedes the card`,
      ).toBeTruthy();
    }

    expect(
      document.querySelector('[aria-modal], [role="dialog"], [inert]'),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: messages.onboarding.dismiss }),
    );
    expect(screen.queryByText(messages.onboarding.invitation)).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute("href")).toBe(routes.termo);
  });
});
