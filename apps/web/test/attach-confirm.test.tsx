import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttachConfirm } from "../app/vincular/attach-confirm";
import AttachLandingPage from "../app/vincular/page";
import { messages } from "../src/i18n";

// The /vincular landing page and its confirm island (#21, D3): an inert
// shell for a scanner's GET, one explicit POST for the human click.

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

const TOKEN = "a".repeat(43);

beforeEach(() => {
  confirmMock.mockReset();
});

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

    // No searchParams at all (the route-ssr call shape): the shell still
    // renders — the explainer state, marker included.
    const missing = renderToStaticMarkup(await AttachLandingPage({}));
    expect(missing).toContain('data-confirm-state="missing"');
    expect(missing).toContain(messages.confirm.missingToken.title);

    // A repeated ?token= arrives as an array — treated as missing, never
    // coerced (serializable STRING props only).
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
    fireEvent.click(
      screen.getByRole("button", { name: messages.confirm.ready.cta }),
    );
    expect(confirmMock).toHaveBeenCalledWith(TOKEN);
    expect(
      await screen.findByText(messages.confirm.attached.title),
    ).toBeInTheDocument();
    attached.unmount();

    confirmMock.mockResolvedValue({ merged: true });
    render(<AttachConfirm token={TOKEN} />);
    fireEvent.click(
      screen.getByRole("button", { name: messages.confirm.ready.cta }),
    );
    expect(
      await screen.findByText(messages.confirm.merged.title),
    ).toBeInTheDocument();
  });

  it("a 410 renders the re-request explainer; a settled failure returns to the button with the inline line", async () => {
    confirmMock.mockResolvedValue("invalid-or-expired");
    const invalid = render(<AttachConfirm token={TOKEN} />);
    fireEvent.click(
      screen.getByRole("button", { name: messages.confirm.ready.cta }),
    );
    expect(
      await screen.findByText(messages.confirm.invalid.title),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.confirm.backHome }),
    ).toBeInTheDocument();
    invalid.unmount();

    // undefined (network/server): the token may still be alive, so the
    // button returns rather than telling the player to burn the link.
    confirmMock.mockResolvedValue(undefined);
    render(<AttachConfirm token={TOKEN} />);
    fireEvent.click(
      screen.getByRole("button", { name: messages.confirm.ready.cta }),
    );
    expect(
      await screen.findByText(messages.confirm.failed),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.confirm.ready.cta }),
    ).toBeInTheDocument();
  });
});
