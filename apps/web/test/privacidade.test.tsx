import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteAccount } from "../app/privacidade/delete-account";
import PrivacyPage from "../app/privacidade/page";
import { messages } from "../src/i18n";

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

    expect(markup).toContain(messages.privacy.deletion.contactEmail);
    expect(markup).toContain(
      `mailto:${messages.privacy.deletion.contactEmail}`,
    );

    expect(markup).toContain(messages.privacy.deletion.selfService);
    expect(markup).toContain(messages.deleteAccount.heading);

    expect(markup).toContain(messages.privacy.consents.body);
    expect(markup).toContain(messages.privacy.why.reminder);
    expect(markup).toContain(messages.privacy.noPassword.body);
    expect(markup).toContain(messages.privacy.collected.telemetry);

    expect(messages.privacy.collected.telemetry).toContain("PostHog");
    expect(messages.privacy.collected.telemetry).toContain("fora do Brasil");
    expect(messages.privacy.collected.telemetry).toContain(
      messages.privacy.deletion.contactEmail,
    );

    expect(messages.privacy.collected.telemetry).toContain(
      "Não gravamos a sua tela",
    );

    expect(markup).toContain(messages.privacy.collected.medals);

    expect(markup).toContain(messages.privacy.collected.push);
  });
});

describe("the deletion island (T-WEB-S142)", () => {
  it("is a two-step confirm: the client is called only after the explicit second step, then the terminal state stands", async () => {
    render(<DeleteAccount />);

    fireEvent.click(
      screen.getByRole("button", { name: messages.deleteAccount.start }),
    );
    expect(screen.getByText(messages.deleteAccount.confirmTitle)).toBeVisible();
    expect(deleteAccountMock).not.toHaveBeenCalled();

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
