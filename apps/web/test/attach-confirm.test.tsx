import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttachConfirm } from "../app/vincular/attach-confirm";
import AttachLandingPage from "../app/vincular/page";
import { messages } from "../src/i18n";

const confirmMock = vi.hoisted(() =>
  vi.fn<
    (
      token: string,
    ) => Promise<
      { merged: boolean } | "invalid-or-expired" | "conflict" | undefined
    >
  >(),
);
vi.mock("../src/attach/attach-client", () => ({
  confirmAttach: confirmMock,
}));

const streakMock = vi.hoisted(() =>
  vi.fn<
    () => Promise<
      { date: string; streak: number; todayCounts: boolean } | undefined
    >
  >(),
);
vi.mock("../src/streak/streak-client", () => ({
  fetchStreak: streakMock,
}));

const TOKEN = "a".repeat(43);

beforeEach(() => {
  confirmMock.mockReset();
  streakMock.mockReset();
  streakMock.mockResolvedValue(undefined);
});

async function findArmedButton(): Promise<HTMLElement> {
  const button = screen.getByRole("button", {
    name: messages.confirm.ready.cta,
  });
  await waitFor(() => {
    expect(button).toBeEnabled();
  });
  return button;
}

describe("the /vincular shell (T-WEB-S139)", () => {
  it("passes the searchParams token to the island as a plain string; a missing token renders the explainer", async () => {
    const withToken = renderToStaticMarkup(
      await AttachLandingPage({
        searchParams: Promise.resolve({ token: TOKEN }),
      }),
    );
    expect(withToken).toContain('data-page="vincular"');
    expect(withToken).toContain('data-confirm-state="ready"');
    expect(withToken).toContain(messages.confirm.ready.cta);

    const missing = renderToStaticMarkup(await AttachLandingPage({}));
    expect(missing).toContain('data-confirm-state="missing"');
    expect(missing).toContain(messages.confirm.missingToken.title);

    const repeated = renderToStaticMarkup(
      await AttachLandingPage({
        searchParams: Promise.resolve({ token: [TOKEN, TOKEN] }),
      }),
    );
    expect(repeated).toContain('data-confirm-state="missing"');
  });
});

describe("the confirm island (T-WEB-S140)", () => {
  it("posts {token} on the explicit click and renders attached vs merged per {merged}", async () => {
    confirmMock.mockResolvedValue({ merged: false });
    const attached = render(<AttachConfirm token={TOKEN} />);
    fireEvent.click(await findArmedButton());
    expect(confirmMock).toHaveBeenCalledWith(TOKEN);
    expect(
      await screen.findByText(messages.confirm.attached.title),
    ).toBeInTheDocument();
    attached.unmount();

    confirmMock.mockResolvedValue({ merged: true });
    render(<AttachConfirm token={TOKEN} />);
    fireEvent.click(await findArmedButton());
    expect(
      await screen.findByText(messages.confirm.merged.title),
    ).toBeInTheDocument();
  });

  it("a 410 renders the re-request explainer; a settled failure returns to the button with the inline line", async () => {
    confirmMock.mockResolvedValue("invalid-or-expired");
    const invalid = render(<AttachConfirm token={TOKEN} />);
    fireEvent.click(await findArmedButton());
    expect(
      await screen.findByText(messages.confirm.invalid.title),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.confirm.backHome }),
    ).toBeInTheDocument();
    invalid.unmount();

    confirmMock.mockResolvedValue(undefined);
    render(<AttachConfirm token={TOKEN} />);
    fireEvent.click(await findArmedButton());
    expect(
      await screen.findByText(messages.confirm.failed),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.confirm.ready.cta }),
    ).toBeInTheDocument();
  });
});

describe("the switch-account gate (T-WEB-S151, step-7 finding D)", () => {
  it("a browser with real history must acknowledge the account switch before the POST arms; the warning copy always renders", async () => {
    streakMock.mockResolvedValue({
      date: "2026-08-13",
      streak: 3,
      todayCounts: true,
    });
    confirmMock.mockResolvedValue({ merged: true });
    render(<AttachConfirm token={TOKEN} />);

    expect(screen.getByText(messages.confirm.ready.warn)).toBeInTheDocument();

    const ack = await screen.findByRole("checkbox", {
      name: messages.confirm.switchAccount.label,
    });
    const button = screen.getByRole("button", {
      name: messages.confirm.ready.cta,
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(confirmMock).not.toHaveBeenCalled();

    fireEvent.click(ack);
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(confirmMock).toHaveBeenCalledWith(TOKEN);
    expect(
      await screen.findByText(messages.confirm.merged.title),
    ).toBeInTheDocument();
  });

  it("a settled no-session browser sees no gate; a zero-history session sees none either", async () => {
    const noSession = render(<AttachConfirm token={TOKEN} />);
    await findArmedButton();
    expect(
      screen.queryByRole("checkbox", {
        name: messages.confirm.switchAccount.label,
      }),
    ).not.toBeInTheDocument();
    noSession.unmount();

    streakMock.mockResolvedValue({
      date: "2026-08-13",
      streak: 0,
      todayCounts: false,
    });
    render(<AttachConfirm token={TOKEN} />);
    await findArmedButton();
    expect(
      screen.queryByRole("checkbox", {
        name: messages.confirm.switchAccount.label,
      }),
    ).not.toBeInTheDocument();
  });
});

describe("the malformed-token explainer (T-WEB-S152, step-7 finding K)", () => {
  it("a token that is not 43 base64url chars renders the incomplete-link explainer and never POSTs", () => {
    for (const bad of [
      "a".repeat(42),
      `${"a".repeat(43)}b`,
      `${"a".repeat(42)}!`,
    ]) {
      const view = render(<AttachConfirm token={bad} />);
      expect(
        screen.getByText(messages.confirm.missingToken.title),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: messages.confirm.ready.cta }),
      ).not.toBeInTheDocument();
      view.unmount();
    }
    expect(confirmMock).not.toHaveBeenCalled();
  });
});
