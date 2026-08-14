import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteAccount } from "../app/privacidade/delete-account";
import PrivacyPage from "../app/privacidade/page";
import { messages } from "../src/i18n";

// The /privacidade page and its deletion island (#21, ADR-0012, D13/D14).
// Every assertion goes through the messages module — never string literals
// — so the copy stays externalized by construction.

const deleteAccountMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
vi.mock("../src/attach/attach-client", () => ({
  deleteAccount: deleteAccountMock,
}));

beforeEach(() => {
  deleteAccountMock.mockClear();
  deleteAccountMock.mockResolvedValue(true);
});

describe("the privacy policy page (T-WEB-S141)", () => {
  it("renders statically with its marker, the contact address, and BOTH deletion paths — matching what D13 actually ships", () => {
    const markup = renderToStaticMarkup(<PrivacyPage />);

    expect(markup).toContain('data-page="privacidade"');
    expect(markup).toContain(messages.privacy.title);
    // The human channel: the address is published and is a real mailto.
    expect(markup).toContain(messages.privacy.deletion.contactEmail);
    expect(markup).toContain(
      `mailto:${messages.privacy.deletion.contactEmail}`,
    );
    // The self-service channel: the page SAYS deletion is immediate and
    // on this page, and the island's own heading is in the same markup.
    expect(markup).toContain(messages.privacy.deletion.selfService);
    expect(markup).toContain(messages.deleteAccount.heading);
    // The LGPD substance the copy must state (ADR-0012): the two
    // independent consents, the reminder default, no password, and no
    // session replay.
    expect(markup).toContain(messages.privacy.consents.body);
    expect(markup).toContain(messages.privacy.why.reminder);
    expect(markup).toContain(messages.privacy.noPassword.body);
    expect(markup).toContain(messages.privacy.collected.telemetry);
    // #30 (ADR-0052): operator-recorded medal grants are data about the
    // user, so the inventory names them the release the table ships.
    expect(markup).toContain(messages.privacy.collected.medals);
  });
});

describe("the deletion island (T-WEB-S142)", () => {
  it("is a two-step confirm: the client is called only after the explicit second step, then the terminal state stands", async () => {
    render(<DeleteAccount />);

    // Step one arms; nothing is deleted yet.
    fireEvent.click(
      screen.getByRole("button", { name: messages.deleteAccount.start }),
    );
    expect(screen.getByText(messages.deleteAccount.confirmTitle)).toBeVisible();
    expect(deleteAccountMock).not.toHaveBeenCalled();

    // Step two is the deliberate act.
    fireEvent.click(
      screen.getByRole("button", { name: messages.deleteAccount.confirm }),
    );
    await waitFor(() => {
      expect(deleteAccountMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(messages.deleteAccount.done)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: messages.deleteAccount.start }),
    ).toBeNull();
  });

  it("cancel returns to rest without calling the client, and a failure shows the error with a retry", async () => {
    render(<DeleteAccount />);
    fireEvent.click(
      screen.getByRole("button", { name: messages.deleteAccount.start }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: messages.deleteAccount.cancel }),
    );
    expect(deleteAccountMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: messages.deleteAccount.start }),
    ).toBeVisible();

    deleteAccountMock.mockResolvedValue(false);
    fireEvent.click(
      screen.getByRole("button", { name: messages.deleteAccount.start }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: messages.deleteAccount.confirm }),
    );
    expect(await screen.findByText(messages.deleteAccount.error)).toBeVisible();
  });
});
