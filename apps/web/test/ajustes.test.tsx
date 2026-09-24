import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSection } from "../app/ajustes/account-section";
import SettingsPage, { metadata } from "../app/ajustes/page";
import { PushSection } from "../app/ajustes/push-section";
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

const accountClient = vi.hoisted(() => ({
  fetchAccountState:
    vi.fn<
      () => Promise<
        { email: string | null; reminderConsent: boolean } | undefined
      >
    >(),
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

describe("/ajustes is a static shell that renders with the API and the database down (T-WEB-S404)", () => {
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

describe("the theme radios read the stored choice and apply a new one (T-WEB-S405)", () => {
  it("checks the stored choice after mount and calls applyThemeChoice on change", () => {
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

describe("the push toggle reads the browser and works from day one (T-WEB-S406)", () => {
  it("an unsupported browser shows the install hint and fires no fetch", async () => {
    removePushBrowser();
    render(<PushSection />);
    await settledPushState("unsupported");
    expect(
      screen.getByText(messages.settings.push.installHint),
    ).toBeInTheDocument();
    expect(pushClient.fetchNotificationsState).not.toHaveBeenCalled();
  });

  it("a server with no VAPID key is unsupported too, and ineligible is not a reason to hide the toggle", async () => {
    installPushBrowser({ permission: "default", subscribed: false });
    pushClient.fetchNotificationsState.mockResolvedValue({
      eligible: false,
      vapidPublicKey: null,
    });
    const view = render(<PushSection />);
    await settledPushState("unsupported");
    view.unmount();

    pushClient.fetchNotificationsState.mockResolvedValue({
      eligible: false,
      vapidPublicKey: "BKey",
    });
    render(<PushSection />);
    await settledPushState("off");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("a denied permission is blocked, with the way to unblock it", async () => {
    installPushBrowser({ permission: "denied", subscribed: false });
    render(<PushSection />);
    await settledPushState("blocked");
    expect(
      screen.getByText(messages.settings.push.blocked),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("turning on stores the subscription and reads on; a denial on the ask goes blocked without dismissing the card", async () => {
    installPushBrowser({ permission: "default", subscribed: false });
    const view = render(<PushSection />);
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
    render(<PushSection />);
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
    const view = render(<PushSection />);
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
    render(<PushSection />);
    await settledPushState("on");
    fireEvent.click(screen.getByRole("switch"));
    expect(
      await screen.findByText(messages.settings.push.error),
    ).toBeInTheDocument();
    expect(await pushState()).toBe("on");
    expect(kept.unsubscribe).not.toHaveBeenCalled();
  });
});

describe("the account section and the way to deletion (T-WEB-S407)", () => {
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

describe("the hub and the policy point at Ajustes (T-WEB-S408)", () => {
  it("the hub nav links /ajustes and the policy names Ajustes as where the reminder is turned off", () => {
    const hub = renderToStaticMarkup(<HojePage />);
    expect(routes.settings).toBe("/ajustes");
    expect(hub).toContain(`href="${routes.settings}"`);
    expect(hub).toContain(messages.hoje.links.settings);
    expect(messages.privacy.collected.push).toContain(messages.settings.title);
  });
});
