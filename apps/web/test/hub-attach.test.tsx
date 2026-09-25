import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HubAttach } from "../app/hub-attach";
import HojePage from "../app/page";
import { messages, routes } from "../src/i18n";

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

async function renderEligibleCard() {
  render(<HubAttach />);
  return await screen.findByText(messages.attach.invitation);
}

describe("HubAttach eligibility gating (T-WEB-S135)", () => {
  it("is absent on the server render and while the state is unresolved, and renders from messages once eligible resolves true", async () => {
    expect(renderToStaticMarkup(<HubAttach />)).toBe("");

    clientMock.fetchAttachState.mockReturnValue(new Promise(() => undefined));
    const { container, unmount } = render(<HubAttach />);
    expect(container.innerHTML).toBe("");
    unmount();

    clientMock.fetchAttachState.mockResolvedValue({ eligible: false });
    const ineligible = render(<HubAttach />);
    await waitFor(() => {
      expect(clientMock.fetchAttachState).toHaveBeenCalled();
    });
    expect(ineligible.container.innerHTML).toBe("");
    ineligible.unmount();

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

    const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    for (const sourcePath of [
      "src/attach/attach-client.ts",
      "src/attach/use-attach-state.ts",
      "app/hub-attach.tsx",
      "src/attach/attach-form.tsx",
      "app/vincular/attach-confirm.tsx",
      "src/onboarding/onboarding-client.ts",
      "src/onboarding/use-onboarding-state.ts",
      "app/hub-onboarding.tsx",

      "src/push/push-client.ts",
      "src/push/use-push-state.ts",
      "src/play/push-prompt-card.tsx",

      "src/api/client.ts",
      "src/api/use-mount-fetch.ts",
      "src/streak/use-streak.ts",
      "src/medals/use-medals.ts",
      "src/stats/use-stats.ts",
      "src/stats/use-stats-calendar.ts",
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
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByLabelText(messages.attach.recoveryLabel));
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() => {
      expect(clientMock.requestAttachLink).toHaveBeenCalledTimes(1);
    });

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

      expect(
        screen.getByLabelText(messages.attach.emailLabel),
      ).toBeInTheDocument();
      view.unmount();
    }
  });
});

describe("the privacy links ride `routes`, never literals (T-WEB-S143)", () => {
  it("the hub nav carries the real /privacidade link and the card's consent copy links it too", async () => {
    const hub = renderToStaticMarkup(<HojePage />);
    expect(hub).toContain(`href="${routes.privacy}"`);
    expect(hub).toContain(messages.hoje.links.privacy);

    await renderEligibleCard();
    const link = screen.getByRole("link", {
      name: messages.attach.privacyLinkLabel,
    });
    expect(link).toHaveAttribute("href", routes.privacy);
  });
});

describe("the terms link rides beside the policy at both legal link sites (T-WEB-S294)", () => {
  it("the hub nav carries the real /termos link and the card's legal-links line links it too", async () => {
    const hub = renderToStaticMarkup(<HojePage />);
    expect(hub).toContain(`href="${routes.terms}"`);
    expect(hub).toContain(messages.hoje.links.terms);

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
