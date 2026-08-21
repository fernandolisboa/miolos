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

// The first-visit introduction card (#35, ADR-0061, plan 057): server-owned
// "seen once", one in-flow paper card AFTER the game cards, never blocking.
// Every assertion goes through the messages module — never string literals.

const clientMock = vi.hoisted(() => ({
  fetchOnboardingState: vi.fn<() => Promise<{ show: boolean } | undefined>>(),
  markOnboardingSeen: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("../src/onboarding/onboarding-client", () => clientMock);

// `ensureSession` is stubbed by SPREADING the real module (the attach-state
// suite's importOriginal discipline): the hook must await the layout's own
// mint, and T-WEB-S250 drives the stub as a deferred promise to prove the
// ordering. Everything else bootstrap exports stays real.
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

/** Render the card and wait for the state fetch to land it. */
async function renderShownCard() {
  render(<HubOnboarding />);
  return await screen.findByText(messages.onboarding.invitation);
}

describe("HubOnboarding first-paint contract (T-WEB-S247)", () => {
  it("the server render is EMPTY — no onboarding markup exists before hydration, so T-WEB-S17/S127's no-fetch-at-render contract is untouched", () => {
    expect(renderToStaticMarkup(<HubOnboarding />)).toBe("");
    // No effect ran: neither the mint nor the state read fires at render.
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();
    expect(clientMock.fetchOnboardingState).not.toHaveBeenCalled();
  });
});

describe("HubOnboarding absent states (T-WEB-S249)", () => {
  it("unresolved, settled-without-a-value and show:false all render nothing — an unreachable server never nags — with the positive control beside them", async () => {
    // Unresolved: a promise that never settles inside this test.
    clientMock.fetchOnboardingState.mockReturnValue(
      new Promise(() => undefined),
    );
    const unresolved = render(<HubOnboarding />);
    await waitFor(() => {
      expect(bootstrapMock.ensureSession).toHaveBeenCalled();
    });
    expect(unresolved.container.innerHTML).toBe("");
    unresolved.unmount();

    // Settled without a value (env unset, non-200, network, parse): null.
    clientMock.fetchOnboardingState.mockResolvedValue(undefined);
    const failed = render(<HubOnboarding />);
    await waitFor(() => {
      expect(clientMock.fetchOnboardingState).toHaveBeenCalled();
    });
    expect(failed.container.innerHTML).toBe("");
    failed.unmount();

    // The server said no — a returning visitor never sees it again.
    clientMock.fetchOnboardingState.mockResolvedValue({ show: false });
    const seen = render(<HubOnboarding />);
    await waitFor(() => {
      expect(clientMock.fetchOnboardingState).toHaveBeenCalled();
    });
    expect(seen.container.innerHTML).toBe("");
    seen.unmount();

    // Positive control: show:true renders the card.
    clientMock.fetchOnboardingState.mockResolvedValue({ show: true });
    await renderShownCard();
  });
});

describe("HubOnboarding awaits the mint before it reads (T-WEB-S250)", () => {
  it("the state fetch is NOT issued until ensureSession resolves — the first-visit 401 race of plan 057 §1.3 stays closed", async () => {
    // A deferred mint: on a genuinely first visit the user row exists only
    // after POST /session returns, so a bare mount fetch would race it
    // into a 401 on the one visit this surface is for.
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
    // The mint is still in flight: the read has NOT been issued.
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

    // The source half, run through the repo's comment stripper (the
    // `code()` helper's shape in eslint-db-wall.test.ts, cited by symbol —
    // napkin item 3: this repo's doc blocks quote copy, so scanning raw
    // source red-herrings on the comments).
    const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const source = readFileSync(join(webRoot, "app/hub-onboarding.tsx"), "utf8")
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
    // No accented pt-BR run survives outside the messages module, and none
    // of the five strings is inlined.
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
    // The rotation is decoration, not motion: dropping it would un-rotate
    // the card, which is a different design, not a calmer one. -0.3deg is
    // #162's one angle for every viewport (T-WEB-S303 pins the sites).
    expect(decl(reduce, "transform")).toBe("rotate(-0.3deg)");
  });
});

describe("HubOnboarding settle names no layout property (T-WEB-S254)", () => {
  it("the card's transition names ONLY opacity and transform, and the module declares no @keyframes", () => {
    const css = stylesheet("app/hub-onboarding.module.css");
    const card = bodyOf(css, ".intro");
    const transition = decl(card, "transition");
    expect(transition).toBeDefined();
    // Every comma-separated item animates opacity or transform — never
    // width, height, padding or margin (impeccable's layout-transition):
    // the card holds its full height in flow from the FIRST frame, so the
    // reflow below it is one frame whatever the duration.
    for (const item of (transition ?? "").split(",")) {
      expect(item.trim()).toMatch(/^(opacity|transform)\s/);
    }
    expect(css).not.toContain("@keyframes");
    // The settle is a mount transition via @starting-style — no JS class
    // flip, and the starting point at each viewport holds the SAME
    // rotation the resting rule declares, so the rotation never animates.
    expect(css).toContain("@starting-style");
  });
});

describe("HubOnboarding landmark and accessible name (T-WEB-S255)", () => {
  it("the card is a <section> named by its OWN rendered <h2> via aria-labelledby — visible text, never an aria-label that can drift", async () => {
    await renderShownCard();

    // role "region" is what a NAMED <section> maps to — the name coming
    // from the rendered invitation heading (plan 057 D6a, against a second
    // unnamed complementary landmark beside hub-attach's <aside>).
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

    // #162: under the full-width games grid, a `max-width: 560px` note sat
    // bottom-left with dead desk to its right and read as misplaced. The
    // page's flex column stretches its children, so declaring NO width cap
    // is exactly what makes the band match the grid's width — the same
    // full-bleed discipline centered-measure.test.ts documents for the
    // hub's own `.page`.
    expect(decl(card, "max-width")).toBeUndefined();
    expect(decl(card, "width")).toBeUndefined();

    // The band's composition: invitation left, body copy right.
    expect(decl(card, "display")).toBe("grid");
    expect(decl(card, "grid-template-columns")).toBe(
      "minmax(0, 2fr) minmax(0, 3fr)",
    );

    // At phone widths the card was never the problem — it stays the
    // stacked full-width paper #35 shipped, and block flow is what makes
    // the children's grid placements inert there.
    const mobile = bodyOf(css, "@media (max-width: 768px)");
    const mobileCard = bodyOf(mobile, ".intro");
    expect(decl(mobileCard, "display")).toBe("block");

    // Step-7 widening of the same band-shape claim, SAME id (the T-DB-9a
    // precedent): the body copy's 512px measure is declared once and the
    // mobile block deliberately does NOT reset it. Below ~550px card width
    // the cap never binds (390px is byte-identical to main), but at
    // 550–768px it does — a deliberate copy measure, better typography
    // than main's uncapped ~700px lines, not a desktop leak.
    expect(decl(bodyOf(css, ".body"), "max-width")).toBe("512px");
    expect(decl(bodyOf(mobile, ".body"), "max-width")).toBeUndefined();

    // One static angle at every site — resting, settle start, and (per
    // T-WEB-S253) the reduce block — so the rotation can never animate and
    // the mobile block needs no angle of its own.
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

    // The four game links exist and each PRECEDES the card in document
    // order: the card sits directly after the grid (before HubAttach —
    // step-6 issue-lens finding, plan 057 §4), so its post-hydration
    // insertion can never move a "Jogar hoje" target.
    for (const route of Object.values(playRoutes)) {
      const link = document.querySelector(`a[href="${route}"]`);
      expect(link, route).not.toBeNull();
      expect(
        link !== null &&
          link.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${route} precedes the card`,
      ).toBeTruthy();
    }

    // Structurally in-flow: no scrim, no dialog semantics, no inert, no
    // focus trap — the "skippable" of AC 1 is one optional button.
    expect(
      document.querySelector('[aria-modal], [role="dialog"], [inert]'),
    ).toBeNull();

    // Dismiss: the button leaves the DOM, so focus is placed deliberately
    // on the FIRST game card's link (document order — page.tsx's
    // gameOrder puts termo first), never dropped to <body> for the next
    // Tab to restart at the masthead (the #67 focus-order class).
    fireEvent.click(
      screen.getByRole("button", { name: messages.onboarding.dismiss }),
    );
    expect(screen.queryByText(messages.onboarding.invitation)).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute("href")).toBe(routes.termo);
  });
});
