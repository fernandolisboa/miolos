import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HubAttach } from "../app/hub-attach";
import HojePage from "../app/page";
import { messages, routes } from "../src/i18n";

// The attach prompt card (#21, D15, ADR-0050 decision 9): server-owned
// eligibility, one lifecycle per account, the repo's first form controls.
// Every assertion goes through the messages module — never string literals.

const clientMock = vi.hoisted(() => ({
  fetchAttachState: vi.fn<() => Promise<{ eligible: boolean } | undefined>>(),
  requestAttachLink: vi.fn(),
  dismissAttachPrompt: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("../src/attach/attach-client", () => clientMock);

beforeEach(() => {
  clientMock.fetchAttachState.mockReset();
  clientMock.requestAttachLink.mockReset();
  clientMock.dismissAttachPrompt.mockClear();
  clientMock.fetchAttachState.mockResolvedValue({ eligible: true });
  clientMock.requestAttachLink.mockResolvedValue("sent");
});

/** Render the card and wait for the eligibility fetch to land it. */
async function renderEligibleCard() {
  render(<HubAttach />);
  return await screen.findByText(messages.attach.invitation);
}

describe("HubAttach eligibility gating (T-WEB-S135)", () => {
  it("is absent on the server render and while the state is unresolved, and renders from messages once eligible resolves true", async () => {
    // The server render: no fetch fires, nothing paints — the hub's
    // first-paint contract (T-WEB-S127) is untouched by this island.
    expect(renderToStaticMarkup(<HubAttach />)).toBe("");

    // Unresolved: a promise that never settles inside this test.
    clientMock.fetchAttachState.mockReturnValue(new Promise(() => undefined));
    const { container, unmount } = render(<HubAttach />);
    expect(container.innerHTML).toBe("");
    unmount();

    // Ineligible: the server said no — nothing renders, ever.
    clientMock.fetchAttachState.mockResolvedValue({ eligible: false });
    const ineligible = render(<HubAttach />);
    await waitFor(() => {
      expect(clientMock.fetchAttachState).toHaveBeenCalled();
    });
    expect(ineligible.container.innerHTML).toBe("");
    ineligible.unmount();

    // Eligible: the card appears, all copy from the messages module.
    clientMock.fetchAttachState.mockResolvedValue({ eligible: true });
    await renderEligibleCard();
    expect(screen.getByText(messages.attach.lead)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.attach.submit }),
    ).toBeInTheDocument();
  });
});

describe("HubAttach dismissal (T-WEB-S136)", () => {
  it("'agora não' calls the dismiss client and the card leaves; no localStorage exists anywhere in the attach modules", async () => {
    await renderEligibleCard();

    fireEvent.click(
      screen.getByRole("button", { name: messages.attach.dismiss }),
    );
    expect(clientMock.dismissAttachPrompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(messages.attach.invitation)).toBeNull();

    // The mechanical half of D9's "server-owned, never localStorage": the
    // attach modules' own sources carry no storage reference at all. #35's
    // onboarding modules join the list (the same D9, plan 057: "per
    // identity, surviving attach/merge" is a thing localStorage cannot do)
    // — a widened claim about the same gate, no new id (the T-WEB-S100
    // burn precedent).
    const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    for (const sourcePath of [
      "src/attach/attach-client.ts",
      "src/attach/use-attach-state.ts",
      "app/hub-attach.tsx",
      "app/vincular/attach-confirm.tsx",
      "src/onboarding/onboarding-client.ts",
      "src/onboarding/use-onboarding-state.ts",
      "app/hub-onboarding.tsx",
      // #145's push modules join (ADR-0064: the dismissal is the
      // attach-prompt lifecycle — device storage re-prompts exactly the
      // cleared-data user) — the same widened claim, no new id.
      "src/push/push-client.ts",
      "src/push/use-push-state.ts",
      "src/play/push-prompt-card.tsx",
    ]) {
      expect(
        readFileSync(join(webRoot, sourcePath), "utf8"),
        sourcePath,
      ).not.toContain("localStorage");
    }
  });
});

describe("HubAttach form semantics (T-WEB-S137)", () => {
  it("the reminder checkbox is UNCHECKED by default, submit is disabled until recovery is checked, and the posted payload is the normalized shape", async () => {
    await renderEligibleCard();

    const reminder = screen.getByLabelText(messages.attach.reminderLabel);
    expect(reminder).not.toBeChecked();

    const submit = screen.getByRole("button", { name: messages.attach.submit });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(messages.attach.emailLabel), {
      target: { value: "  Jogadora@Example.COM " },
    });
    expect(submit).toBeDisabled(); // still: recovery is the gate

    fireEvent.click(screen.getByLabelText(messages.attach.recoveryLabel));
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() => {
      expect(clientMock.requestAttachLink).toHaveBeenCalledTimes(1);
    });
    // Normalized BEFORE the wire: the same boundary schema the api parses.
    expect(clientMock.requestAttachLink).toHaveBeenCalledWith({
      email: "jogadora@example.com",
      recoveryConsent: true,
      reminderConsent: false,
    });
  });
});

describe("HubAttach sent and error states (T-WEB-S138)", () => {
  it("the sent state replaces the form and shows the normalized address; errors render inline from messages", async () => {
    await renderEligibleCard();
    fireEvent.change(screen.getByLabelText(messages.attach.emailLabel), {
      target: { value: "Jogadora@Example.COM" },
    });
    fireEvent.click(screen.getByLabelText(messages.attach.recoveryLabel));
    fireEvent.click(
      screen.getByRole("button", { name: messages.attach.submit }),
    );

    expect(
      await screen.findByText(messages.attach.sent("jogadora@example.com")),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.attach.sentNote)).toBeInTheDocument();
    expect(screen.queryByLabelText(messages.attach.emailLabel)).toBeNull();
  });

  it("a rate-limit, an already-attached and a generic failure each render their own inline message and keep the form", async () => {
    const cases = [
      ["rate-limited", messages.attach.errors.rateLimited],
      ["already-attached", messages.attach.errors.alreadyAttached],
      [undefined, messages.attach.errors.generic],
    ] as const;

    for (const [result, copy] of cases) {
      clientMock.fetchAttachState.mockResolvedValue({ eligible: true });
      clientMock.requestAttachLink.mockResolvedValue(result);
      const view = render(<HubAttach />);
      await screen.findByText(messages.attach.invitation);
      fireEvent.change(screen.getByLabelText(messages.attach.emailLabel), {
        target: { value: "jogadora@example.com" },
      });
      fireEvent.click(screen.getByLabelText(messages.attach.recoveryLabel));
      fireEvent.click(
        screen.getByRole("button", { name: messages.attach.submit }),
      );
      expect(await screen.findByText(copy)).toBeInTheDocument();
      // The form survives an error — the player fixes and retries.
      expect(
        screen.getByLabelText(messages.attach.emailLabel),
      ).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("the privacy links ride `routes`, never literals (T-WEB-S143)", () => {
  it("the hub nav carries the real /privacidade link and the card's consent copy links it too", async () => {
    // The server page: the secondary nav's new href is the routes value.
    const hub = renderToStaticMarkup(<HojePage />);
    expect(hub).toContain(`href="${routes.privacy}"`);
    expect(hub).toContain(messages.hoje.links.privacy);

    // The card: the consent copy's link into the policy.
    await renderEligibleCard();
    const link = screen.getByRole("link", {
      name: messages.attach.privacyLinkLabel,
    });
    expect(link).toHaveAttribute("href", routes.privacy);
  });
});

describe("the terms link rides beside the policy at both legal link sites (T-WEB-S294)", () => {
  it("the hub nav carries the real /termos link and the card's legal-links line links it too", async () => {
    // The server page: the fifth secondary-nav href is the routes value —
    // T-WEB-S143's shape, applied to #158's link.
    const hub = renderToStaticMarkup(<HojePage />);
    expect(hub).toContain(`href="${routes.terms}"`);
    expect(hub).toContain(messages.hoje.links.terms);

    // The card: the terms sit on the same quiet line as the policy link.
    await renderEligibleCard();
    const link = screen.getByRole("link", {
      name: messages.attach.termsLinkLabel,
    });
    expect(link).toHaveAttribute("href", routes.terms);
  });
});

describe("form-control accessibility pins (T-WEB-S144)", () => {
  it("labels are bound to inputs, the checkboxes are native inputs, and dismiss/submit are buttons", async () => {
    await renderEligibleCard();

    const email = screen.getByLabelText(messages.attach.emailLabel);
    expect(email.tagName).toBe("INPUT");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("id");

    for (const label of [
      messages.attach.recoveryLabel,
      messages.attach.reminderLabel,
    ]) {
      const checkbox = screen.getByLabelText(label);
      expect(checkbox.tagName).toBe("INPUT");
      expect(checkbox).toHaveAttribute("type", "checkbox");
    }

    expect(
      screen.getByRole("button", { name: messages.attach.submit }).tagName,
    ).toBe("BUTTON");
    expect(
      screen.getByRole("button", { name: messages.attach.dismiss }).tagName,
    ).toBe("BUTTON");
  });
});
