import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSection } from "../app/ajustes/account-section";
import SettingsPage, { metadata } from "../app/ajustes/page";
import { ReminderSection } from "../app/ajustes/reminder-section";
import { ThemeSection } from "../app/ajustes/theme-section";
import HojePage from "../app/page";
import PrivacyPage from "../app/privacidade/page";
import { deleteAccountAnchor, messages, routes } from "../src/i18n";
import { closureOf } from "./module-graph";

const pushClient = vi.hoisted(() => ({
  fetchNotificationsState:
    vi.fn<
      () => Promise<
        { eligible: boolean; vapidPublicKey: string | null } | undefined
      >
    >(),
  postPushSubscription: vi.fn(() => Promise.resolve(true)),
  deletePushSubscription: vi.fn(() => Promise.resolve(true)),
  dismissPushPrompt: vi.fn(() => Promise.resolve(true)),
  applicationServerKeyBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
}));
vi.mock("../src/push/push-client", () => pushClient);

const attachClient = vi.hoisted(() => ({
  requestAttachLink: vi.fn(() => Promise.resolve("sent" as const)),
  fetchAttachState: vi.fn(),
}));
vi.mock("../src/attach/attach-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/attach/attach-client")>()),
  requestAttachLink: attachClient.requestAttachLink,
  fetchAttachState: attachClient.fetchAttachState,
}));

const accountClient = vi.hoisted(() => ({
  fetchAccountState:
    vi.fn<
      () => Promise<
        { email: string | null; reminderConsent: boolean } | undefined
      >
    >(),
  setReminderConsent:
    vi.fn<(granted: boolean) => Promise<boolean | undefined>>(),
  detachAccountEmail: vi.fn<() => Promise<boolean>>(),
}));
vi.mock("../src/account/account-client", () => accountClient);

vi.mock("../src/session/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/session/bootstrap")>()),
  ensureSession: () => Promise.resolve(),
}));

const theme = vi.hoisted(() => ({
  readThemeChoice: vi.fn<() => "system" | "light" | "dark">(() => "system"),
  applyThemeChoice: vi.fn(),
}));
vi.mock("../src/theme/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/theme/theme")>()),
  readThemeChoice: theme.readThemeChoice,
  applyThemeChoice: theme.applyThemeChoice,
}));

const ENDPOINT = "https://push.example.org/send/this-install";

function installPushBrowser(options: {
  permission: NotificationPermission;
  subscribed: boolean;
  deniesOnSubscribe?: boolean;
}) {
  const notification = { permission: options.permission };
  Object.defineProperty(window, "Notification", {
    value: notification,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "PushManager", {
    value: class PushManager {},
    configurable: true,
    writable: true,
  });
  let current: object | null = null;
  const unsubscribe = vi.fn(() => {
    current = null;
    return Promise.resolve(true);
  });
  const subscription = {
    endpoint: ENDPOINT,
    unsubscribe,
    toJSON: () => ({
      endpoint: ENDPOINT,
      keys: { p256dh: "client-p256dh", auth: "client-auth" },
    }),
  };
  current = options.subscribed ? subscription : null;
  const registration = {
    pushManager: {
      subscribe: vi.fn(() => {
        if (options.deniesOnSubscribe) {
          notification.permission = "denied";
          return Promise.reject(new Error("NotAllowedError"));
        }
        current = subscription;
        return Promise.resolve(subscription);
      }),
      getSubscription: vi.fn(() => Promise.resolve(current)),
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      register: vi.fn(() => Promise.resolve(registration)),
      ready: Promise.resolve(registration),
      getRegistration: vi.fn(() => Promise.resolve(registration)),
    },
    configurable: true,
  });
  return { unsubscribe };
}

function removePushBrowser(): void {
  for (const key of ["Notification", "PushManager"] as const) {
    Reflect.deleteProperty(window, key);
  }
  Reflect.deleteProperty(navigator, "serviceWorker");
}

async function pushState(): Promise<string | null> {
  const section = await screen.findByRole("region", {
    name: messages.settings.push.heading,
  });
  return section.getAttribute("data-push-state");
}

async function settledPushState(expected: string): Promise<void> {
  await waitFor(async () => {
    expect(await pushState()).toBe(expected);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  pushClient.fetchNotificationsState.mockResolvedValue({
    eligible: false,
    vapidPublicKey: "BKey",
  });
  pushClient.deletePushSubscription.mockImplementation(() =>
    Promise.resolve(true),
  );
  accountClient.fetchAccountState.mockResolvedValue(undefined);
  theme.readThemeChoice.mockReturnValue("system");
});

afterEach(() => {
  removePushBrowser();
});

describe("/ajustes is a static shell that renders with the API and the database down (T-WEB-S400)", () => {
  it("renders its marker, title and every section heading with no fetch resolved, is noindex, and reaches no database module", () => {
    const markup = renderToStaticMarkup(<SettingsPage />);
    expect(markup).toContain('data-page="ajustes"');
    for (const text of [
      messages.settings.title,
      messages.settings.theme.heading,
      messages.settings.push.heading,
      messages.settings.account.heading,
      messages.settings.deletion.heading,
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain(`href="${routes.home}"`);
    expect(metadata.robots).toEqual({ index: false, follow: false });

    const graph = [...closureOf("apps/web/app/ajustes/page.tsx")];
    expect(
      graph.filter(
        (module) =>
          module === "apps/web/src/db.ts" || module.startsWith("packages/db/"),
      ),
    ).toEqual([]);
  });
});

describe("the theme radios read the stored choice and apply a new one (T-WEB-S401)", () => {
  it("renders the server snapshot on the server, then hydrates to the stored choice", () => {
    theme.readThemeChoice.mockReturnValue("dark");
    const html = renderToString(<ThemeSection />);

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);

    expect(
      container.querySelector<HTMLInputElement>('input[value="system"]')
        ?.checked,
    ).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('input[value="dark"]')?.checked,
    ).toBe(false);

    act(() => {
      hydrateRoot(container, <ThemeSection />);
    });

    expect(
      container.querySelector<HTMLInputElement>('input[value="dark"]')?.checked,
    ).toBe(true);

    container.remove();
  });

  it("checks the stored choice and calls applyThemeChoice on change", () => {
    theme.readThemeChoice.mockReturnValue("dark");
    render(<ThemeSection />);

    const group = screen.getByRole("group", {
      name: messages.settings.theme.legend,
    });
    expect(group.tagName).toBe("FIELDSET");
    expect(
      screen.getByRole("radio", { name: messages.settings.theme.dark }),
    ).toBeChecked();

    fireEvent.click(
      screen.getByRole("radio", { name: messages.settings.theme.light }),
    );
    expect(theme.applyThemeChoice).toHaveBeenCalledWith("light");
    expect(
      screen.getByRole("radio", { name: messages.settings.theme.light }),
    ).toBeChecked();

    fireEvent.click(
      screen.getByRole("radio", { name: messages.settings.theme.system }),
    );
    expect(theme.applyThemeChoice).toHaveBeenLastCalledWith("system");
  });
});

describe("the reminder switch reads the browser and works from day one (T-WEB-S402)", () => {
  it("an unsupported browser shows the install hint and fires no fetch", async () => {
    removePushBrowser();
    render(<ReminderSection />);
    await settledPushState("unsupported");
    expect(
      screen.getByText(messages.settings.push.installHint),
    ).toBeInTheDocument();
    expect(pushClient.fetchNotificationsState).not.toHaveBeenCalled();
  });

  it("a server with no VAPID key is unsupported too, with no install hint, and ineligible is not a reason to hide the toggle", async () => {
    installPushBrowser({ permission: "default", subscribed: false });
    pushClient.fetchNotificationsState.mockResolvedValue({
      eligible: false,
      vapidPublicKey: null,
    });
    const view = render(<ReminderSection />);
    await settledPushState("unsupported");
    expect(
      screen.queryByText(messages.settings.push.installHint),
    ).not.toBeInTheDocument();
    view.unmount();

    pushClient.fetchNotificationsState.mockResolvedValue({
      eligible: false,
      vapidPublicKey: "BKey",
    });
    render(<ReminderSection />);
    await settledPushState("off");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("a failed fetch of /notifications/state gets its own error state, with no install hint", async () => {
    installPushBrowser({ permission: "default", subscribed: false });
    pushClient.fetchNotificationsState.mockResolvedValue(undefined);
    render(<ReminderSection />);
    await settledPushState("error");
    expect(screen.getByText(messages.settings.push.error)).toBeInTheDocument();
    expect(
      screen.queryByText(messages.settings.push.installHint),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("a throwing getSubscription on a push-capable browser is an error, never the install hint", async () => {
    installPushBrowser({ permission: "default", subscribed: false });
    vi.spyOn(navigator.serviceWorker, "getRegistration").mockRejectedValue(
      new Error("InvalidStateError"),
    );
    render(<ReminderSection />);
    await settledPushState("error");
    expect(
      screen.queryByText(messages.settings.push.installHint),
    ).not.toBeInTheDocument();
  });

  it("a denied permission is blocked, with the way to unblock it", async () => {
    installPushBrowser({ permission: "denied", subscribed: false });
    render(<ReminderSection />);
    await settledPushState("blocked");
    expect(
      screen.getByText(messages.settings.push.blocked),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("turning on stores the subscription and reads on; a denial on the ask goes blocked without dismissing the card", async () => {
    installPushBrowser({ permission: "default", subscribed: false });
    const view = render(<ReminderSection />);
    await settledPushState("off");
    fireEvent.click(screen.getByRole("switch"));
    await settledPushState("on");
    expect(pushClient.postPushSubscription).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    view.unmount();

    installPushBrowser({
      permission: "default",
      subscribed: false,
      deniesOnSubscribe: true,
    });
    render(<ReminderSection />);
    await settledPushState("off");
    fireEvent.click(screen.getByRole("switch"));
    await settledPushState("blocked");
    expect(pushClient.dismissPushPrompt).not.toHaveBeenCalled();
  });

  it("turning off sends the DELETE before unsubscribe, and a failed DELETE keeps it on with the error", async () => {
    const order: string[] = [];
    const { unsubscribe } = installPushBrowser({
      permission: "granted",
      subscribed: true,
    });
    unsubscribe.mockImplementation(() => {
      order.push("unsubscribe");
      return Promise.resolve(true);
    });
    pushClient.deletePushSubscription.mockImplementation(() => {
      order.push("delete");
      return Promise.resolve(true);
    });
    const view = render(<ReminderSection />);
    await settledPushState("on");
    fireEvent.click(screen.getByRole("switch"));
    await settledPushState("off");
    expect(order).toEqual(["delete", "unsubscribe"]);
    view.unmount();

    const kept = installPushBrowser({
      permission: "granted",
      subscribed: true,
    });
    pushClient.deletePushSubscription.mockResolvedValue(false);
    render(<ReminderSection />);
    await settledPushState("on");
    fireEvent.click(screen.getByRole("switch"));
    expect(
      await screen.findByText(messages.settings.push.error),
    ).toBeInTheDocument();
    expect(await pushState()).toBe("on");
    expect(kept.unsubscribe).not.toHaveBeenCalled();
  });
});

describe("the account section and the way to deletion (T-WEB-S403)", () => {
  it("shows the attached email in full, the no-email line, or the neutral fallback", async () => {
    accountClient.fetchAccountState.mockResolvedValue({
      email: "jogadora@example.com",
      reminderConsent: true,
    });
    const attached = render(<AccountSection />);
    expect(await screen.findByText("jogadora@example.com")).toBeInTheDocument();
    attached.unmount();

    accountClient.fetchAccountState.mockResolvedValue({
      email: null,
      reminderConsent: false,
    });
    const none = render(<AccountSection />);
    expect(
      await screen.findByText(messages.settings.account.none),
    ).toBeInTheDocument();
    none.unmount();

    accountClient.fetchAccountState.mockResolvedValue(undefined);
    render(<AccountSection />);
    expect(
      await screen.findByText(messages.settings.account.unavailable),
    ).toBeInTheDocument();
  });

  it("links to the deletion section on /privacidade, which carries the anchor", () => {
    const settings = renderToStaticMarkup(<SettingsPage />);
    expect(settings).toContain(
      `href="${routes.privacy}#${deleteAccountAnchor}"`,
    );
    expect(renderToStaticMarkup(<PrivacyPage />)).toContain(
      `id="${deleteAccountAnchor}"`,
    );
  });
});

describe("the hub and the policy point at Ajustes (T-WEB-S404)", () => {
  it("the hub nav links /ajustes and the policy names Ajustes as where the reminder is turned off", () => {
    const hub = renderToStaticMarkup(<HojePage />);
    expect(routes.settings).toBe("/ajustes");
    expect(hub).toContain(`href="${routes.settings}"`);
    expect(hub).toContain(messages.hoje.links.settings);
    expect(messages.privacy.collected.push).toContain(messages.settings.title);
  });
});

function attachedAccount(reminderConsent: boolean): void {
  accountClient.fetchAccountState.mockResolvedValue({
    email: "jogadora@example.com",
    reminderConsent,
  });
}

async function reminderCheckbox(): Promise<HTMLElement> {
  return await screen.findByRole("checkbox", {
    name: messages.attach.reminderLabel,
  });
}

describe("the email-reminder checkbox (T-WEB-S407)", () => {
  it("shows only with an email attached, reuses the attach form's consent label, and is checked from reminderConsent", async () => {
    accountClient.fetchAccountState.mockResolvedValue({
      email: null,
      reminderConsent: false,
    });
    const none = render(<AccountSection />);
    await screen.findByText(messages.settings.account.none);
    expect(document.getElementById("settings-email-reminder")).toBeNull();
    none.unmount();

    attachedAccount(true);
    const on = render(<AccountSection />);
    expect(await reminderCheckbox()).toBeChecked();
    on.unmount();

    attachedAccount(false);
    render(<AccountSection />);
    expect(await reminderCheckbox()).not.toBeChecked();
  });

  it("a change calls the endpoint and takes the server's answer; a failure shows the error and re-reads the account", async () => {
    attachedAccount(true);
    accountClient.setReminderConsent.mockResolvedValue(false);
    render(<AccountSection />);
    fireEvent.click(await reminderCheckbox());
    await waitFor(async () => {
      expect(await reminderCheckbox()).not.toBeChecked();
    });
    expect(accountClient.setReminderConsent).toHaveBeenCalledWith(false);
    expect(
      screen.queryByText(messages.settings.account.reminderError),
    ).toBeNull();

    attachedAccount(false);
    accountClient.setReminderConsent.mockResolvedValue(undefined);
    fireEvent.click(await reminderCheckbox());
    expect(
      await screen.findByText(messages.settings.account.reminderError),
    ).toBeInTheDocument();
    expect(accountClient.setReminderConsent).toHaveBeenLastCalledWith(true);
    expect(accountClient.fetchAccountState).toHaveBeenCalledTimes(2);
    expect(await reminderCheckbox()).not.toBeChecked();
    expect(await reminderCheckbox()).toBeEnabled();
  });
});

describe("removing the email takes an explicit confirm (T-WEB-S408)", () => {
  const detach = messages.settings.account.detach;

  it("nothing is sent before the confirm, cancel goes back, and a confirmed detach shows the no-email state", async () => {
    attachedAccount(true);
    accountClient.detachAccountEmail.mockResolvedValue(true);
    render(<AccountSection />);

    fireEvent.click(await screen.findByRole("button", { name: detach.start }));
    expect(screen.getByText(detach.confirmTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: detach.cancel }));
    expect(screen.queryByText(detach.confirmTitle)).toBeNull();
    expect(accountClient.detachAccountEmail).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: detach.start }));
    fireEvent.click(screen.getByRole("button", { name: detach.confirm }));
    expect(
      await screen.findByText(messages.settings.account.none),
    ).toBeInTheDocument();
    expect(screen.getByText(detach.done)).toBeInTheDocument();
    expect(accountClient.detachAccountEmail).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("jogadora@example.com")).toBeNull();
    expect(document.getElementById("settings-email-reminder")).toBeNull();
  });

  it("a failed detach keeps the email and shows the error with a retry", async () => {
    attachedAccount(false);
    accountClient.detachAccountEmail.mockResolvedValue(false);
    render(<AccountSection />);

    fireEvent.click(await screen.findByRole("button", { name: detach.start }));
    fireEvent.click(screen.getByRole("button", { name: detach.confirm }));
    expect(await screen.findByText(detach.error)).toBeInTheDocument();
    expect(screen.getByText("jogadora@example.com")).toBeInTheDocument();

    accountClient.detachAccountEmail.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: detach.confirm }));
    expect(
      await screen.findByText(messages.settings.account.none),
    ).toBeInTheDocument();
  });
});

describe("the policy names Ajustes as where the email is removed (T-WEB-S409)", () => {
  it("the recovery line points at Ajustes, and the reminder line at its checkbox", () => {
    expect(messages.privacy.why.recovery).toContain(messages.settings.title);
    expect(messages.privacy.why.reminder).toContain(messages.settings.title);
  });
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("the account controls hold still while a call is in flight (T-WEB-S411)", () => {
  it("the checkbox and the confirm button are disabled until their promise settles", async () => {
    attachedAccount(false);
    const consent = deferred<boolean | undefined>();
    accountClient.setReminderConsent.mockReturnValue(consent.promise);
    const detached = deferred<boolean>();
    accountClient.detachAccountEmail.mockReturnValue(detached.promise);
    render(<AccountSection />);

    fireEvent.click(await reminderCheckbox());
    expect(await reminderCheckbox()).toBeDisabled();
    await act(async () => {
      consent.resolve(true);
      await consent.promise;
    });
    expect(await reminderCheckbox()).toBeEnabled();
    expect(await reminderCheckbox()).toBeChecked();

    const detach = messages.settings.account.detach;
    fireEvent.click(screen.getByRole("button", { name: detach.start }));
    fireEvent.click(screen.getByRole("button", { name: detach.confirm }));
    expect(screen.getByRole("button", { name: detach.busy })).toBeDisabled();
    expect(screen.getByRole("button", { name: detach.cancel })).toBeDisabled();
    await act(async () => {
      detached.resolve(true);
      await detached.promise;
    });
    expect(
      await screen.findByText(messages.settings.account.none),
    ).toBeInTheDocument();
  });
});

describe("a failed write re-reads the account and trusts what it finds (T-WEB-S412)", () => {
  it("a reminder failure or a detach failure whose re-read finds no email shows the no-email state", async () => {
    attachedAccount(true);
    accountClient.setReminderConsent.mockResolvedValue(undefined);
    const first = render(<AccountSection />);
    const checkbox = await reminderCheckbox();
    accountClient.fetchAccountState.mockResolvedValue({
      email: null,
      reminderConsent: false,
    });
    fireEvent.click(checkbox);
    expect(
      await screen.findByText(messages.settings.account.none),
    ).toBeInTheDocument();
    first.unmount();

    attachedAccount(true);
    accountClient.detachAccountEmail.mockResolvedValue(false);
    render(<AccountSection />);
    const detach = messages.settings.account.detach;
    fireEvent.click(await screen.findByRole("button", { name: detach.start }));
    accountClient.fetchAccountState.mockResolvedValue({
      email: null,
      reminderConsent: false,
    });
    fireEvent.click(screen.getByRole("button", { name: detach.confirm }));
    expect(
      await screen.findByText(messages.settings.account.none),
    ).toBeInTheDocument();
    expect(screen.queryByText("jogadora@example.com")).toBeNull();
  });
});

describe("a player with no email can attach one from Ajustes (T-WEB-S413)", () => {
  it("the no-email state offers the attach form, with no eligibility read, and sends the request", async () => {
    accountClient.fetchAccountState.mockResolvedValue({
      email: null,
      reminderConsent: false,
    });
    render(<AccountSection />);
    fireEvent.change(
      await screen.findByRole("textbox", { name: messages.attach.emailLabel }),
      {
        target: { value: "jogadora@example.com" },
      },
    );
    fireEvent.click(screen.getByLabelText(messages.attach.recoveryLabel));
    fireEvent.click(
      screen.getByRole("button", { name: messages.attach.submit }),
    );
    expect(
      await screen.findByText(messages.attach.sent("jogadora@example.com")),
    ).toBeInTheDocument();
    expect(attachClient.requestAttachLink).toHaveBeenCalledWith({
      email: "jogadora@example.com",
      recoveryConsent: true,
      reminderConsent: false,
    });
    expect(attachClient.fetchAttachState).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: messages.attach.dismiss }),
    ).toBeNull();
  });
});
