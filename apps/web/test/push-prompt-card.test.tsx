import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { PushPromptCard } from "../src/play/push-prompt-card";
import { usePushState } from "../src/push/use-push-state";

const clientMock = vi.hoisted(() => ({
  fetchNotificationsState:
    vi.fn<
      () => Promise<
        { eligible: boolean; vapidPublicKey: string | null } | undefined
      >
    >(),
  postPushSubscription: vi.fn(() => Promise.resolve(true)),
  dismissPushPrompt: vi.fn(() => Promise.resolve(true)),
  applicationServerKeyBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
}));
vi.mock("../src/push/push-client", () => clientMock);

const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

const SUB_ENDPOINT = "https://push.example.org/send/this-install";

const FETCH_ENABLED = () => true;
const FETCH_DISABLED = () => false;

function installNotification(permission: NotificationPermission): {
  permission: NotificationPermission;
} {
  const notification = { permission };
  Object.defineProperty(window, "Notification", {
    value: notification,
    configurable: true,
    writable: true,
  });
  return notification;
}

function installPushManager(): void {
  Object.defineProperty(window, "PushManager", {
    value: class PushManager {},
    configurable: true,
    writable: true,
  });
}

function installServiceWorker(options?: {
  existingSubscription?: boolean;
  subscribeRejects?: boolean;
  keylessSubscription?: boolean;
}) {
  let readySettled = false;
  const unsubscribe = vi.fn(() => Promise.resolve(true));
  const subscription = {
    endpoint: SUB_ENDPOINT,
    unsubscribe,
    toJSON: () =>
      options?.keylessSubscription
        ? { endpoint: SUB_ENDPOINT }
        : {
            endpoint: SUB_ENDPOINT,
            keys: { p256dh: "client-p256dh", auth: "client-auth" },
          },
  };
  const subscribe = vi.fn(() => {
    if (!readySettled) {
      return Promise.reject(
        new Error("InvalidStateError: no active worker — awaited ready?"),
      );
    }
    if (options?.subscribeRejects) {
      return Promise.reject(new Error("NotAllowedError"));
    }
    return Promise.resolve(subscription);
  });
  const registration = {
    pushManager: {
      subscribe,
      getSubscription: vi.fn(() =>
        Promise.resolve(options?.existingSubscription ? subscription : null),
      ),
    },
  };
  let resolveReady: (value: typeof registration) => void = () => undefined;
  const ready = new Promise<typeof registration>((resolve) => {
    resolveReady = resolve;
  });
  const register = vi.fn(() => Promise.resolve(registration));
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      register,
      ready,
      getRegistration: vi.fn(() =>
        Promise.resolve(
          options?.existingSubscription ? registration : undefined,
        ),
      ),
    },
    configurable: true,
  });
  return {
    register,
    subscribe,
    unsubscribe,
    settleReady: () => {
      readySettled = true;
      resolveReady(registration);
    },
  };
}

function installSupportedBrowser() {
  const notification = installNotification("default");
  installPushManager();
  const serviceWorker = installServiceWorker();
  return { notification, serviceWorker };
}

beforeEach(() => {
  clientMock.fetchNotificationsState.mockReset();
  clientMock.postPushSubscription.mockClear();
  clientMock.dismissPushPrompt.mockClear();
  bootstrapMock.ensureSession.mockReset();
  bootstrapMock.ensureSession.mockImplementation(() => Promise.resolve());
  clientMock.fetchNotificationsState.mockResolvedValue({
    eligible: true,
    vapidPublicKey: "BServerKey",
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(navigator, "serviceWorker");
});

async function renderShownCard() {
  const view = render(<PushPromptCard />);
  await screen.findByText(messages.push.title);
  return view;
}

describe("usePushState awaits the mint and keeps three honest states (T-WEB-S264)", () => {
  it("the state fetch is NOT issued until ensureSession resolves, and the hook answers undefined → value/null honestly", async () => {
    let releaseMint = (): void => undefined;
    bootstrapMock.ensureSession.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseMint = resolve;
      }),
    );

    const { result } = renderHook(() => usePushState(FETCH_ENABLED));

    expect(result.current).toBeUndefined();
    await waitFor(() => {
      expect(bootstrapMock.ensureSession).toHaveBeenCalled();
    });
    expect(clientMock.fetchNotificationsState).not.toHaveBeenCalled();

    releaseMint();
    await waitFor(() => {
      expect(result.current).toEqual({
        eligible: true,
        vapidPublicKey: "BServerKey",
      });
    });
    expect(clientMock.fetchNotificationsState).toHaveBeenCalledTimes(1);

    clientMock.fetchNotificationsState.mockResolvedValue(undefined);
    const failed = renderHook(() => usePushState(FETCH_ENABLED));
    await waitFor(() => {
      expect(failed.result.current).toBeNull();
    });

    bootstrapMock.ensureSession.mockClear();
    clientMock.fetchNotificationsState.mockClear();
    const suppressed = renderHook(() => usePushState(FETCH_DISABLED));
    await Promise.resolve();
    await Promise.resolve();
    expect(suppressed.result.current).toBeUndefined();
    expect(bootstrapMock.ensureSession).not.toHaveBeenCalled();
    expect(clientMock.fetchNotificationsState).not.toHaveBeenCalled();
  });
});

describe("the render gate is a conjunction and every conjunct binds (T-WEB-S265)", () => {
  it("renders on all-yes (the positive control), and each falsified conjunct alone keeps it out: ineligible, null key, permission granted/denied (which also suppresses the state fetch), an existing local subscription — and the server render is empty", async () => {
    expect(renderToStaticMarkup(<PushPromptCard />)).toBe("");

    installSupportedBrowser();
    const shown = await renderShownCard();
    expect(
      screen.getByRole("button", { name: messages.push.accept }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: messages.push.decline }),
    ).toBeVisible();

    const section = screen.getByRole("region", {
      name: messages.push.title,
    });
    expect(section).toBeVisible();
    shown.unmount();

    clientMock.fetchNotificationsState.mockResolvedValue({
      eligible: false,
      vapidPublicKey: "BServerKey",
    });
    installSupportedBrowser();
    const ineligible = render(<PushPromptCard />);
    await waitFor(() => {
      expect(clientMock.fetchNotificationsState).toHaveBeenCalled();
    });
    expect(ineligible.container.innerHTML).toBe("");
    ineligible.unmount();

    clientMock.fetchNotificationsState.mockResolvedValue({
      eligible: true,
      vapidPublicKey: null,
    });
    installSupportedBrowser();
    const keyless = render(<PushPromptCard />);
    await waitFor(() => {
      expect(clientMock.fetchNotificationsState).toHaveBeenCalled();
    });
    expect(keyless.container.innerHTML).toBe("");
    keyless.unmount();

    clientMock.fetchNotificationsState.mockResolvedValue({
      eligible: true,
      vapidPublicKey: "BServerKey",
    });
    for (const permission of ["granted", "denied"] as const) {
      clientMock.fetchNotificationsState.mockClear();
      installNotification(permission);
      installPushManager();
      installServiceWorker();
      const settled = render(<PushPromptCard />);

      await Promise.resolve();
      await Promise.resolve();
      expect(settled.container.innerHTML, permission).toBe("");
      expect(
        clientMock.fetchNotificationsState,
        `${permission}: no state fetch`,
      ).not.toHaveBeenCalled();
      settled.unmount();
    }
    clientMock.fetchNotificationsState.mockClear();

    installNotification("default");
    installPushManager();
    installServiceWorker({ existingSubscription: true });
    const subscribed = render(<PushPromptCard />);
    await waitFor(() => {
      expect(clientMock.fetchNotificationsState).toHaveBeenCalled();
    });
    expect(subscribed.container.innerHTML).toBe("");
  });
});

describe("each absent feature-detect leg hides the card, fires no fetch, and never throws (T-WEB-S266)", () => {
  it("no Notification (iOS Safari uninstalled), no serviceWorker (non-secure context), no PushManager (older Safari/WebViews) — each alone renders nothing AND suppresses the credentialed GET", async () => {
    installPushManager();
    installServiceWorker();
    const noNotification = render(<PushPromptCard />);
    await Promise.resolve();
    await Promise.resolve();
    expect(noNotification.container.innerHTML).toBe("");
    expect(clientMock.fetchNotificationsState).not.toHaveBeenCalled();
    noNotification.unmount();
    Reflect.deleteProperty(window, "PushManager");
    Reflect.deleteProperty(navigator, "serviceWorker");

    installNotification("default");
    installPushManager();
    const noServiceWorker = render(<PushPromptCard />);
    await Promise.resolve();
    await Promise.resolve();
    expect(noServiceWorker.container.innerHTML).toBe("");
    expect(clientMock.fetchNotificationsState).not.toHaveBeenCalled();
    noServiceWorker.unmount();
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(window, "PushManager");

    installNotification("default");
    installServiceWorker();
    const noPushManager = render(<PushPromptCard />);
    await Promise.resolve();
    await Promise.resolve();
    expect(noPushManager.container.innerHTML).toBe("");
    expect(clientMock.fetchNotificationsState).not.toHaveBeenCalled();
  });
});

describe("accept subscribes in the order that works (T-WEB-S267)", () => {
  it("register → serviceWorker.ready → subscribe, pinned — subscribe never fires before ready resolves — the card stays (disabled) as the permission dialog's framing, then the POST carries the subscription, the card leaves, and nothing is stamped", async () => {
    const { serviceWorker } = installSupportedBrowser();
    await renderShownCard();

    fireEvent.click(screen.getByRole("button", { name: messages.push.accept }));

    expect(screen.getByText(messages.push.title)).toBeVisible();
    expect(
      screen.getByRole("button", { name: messages.push.accept }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: messages.push.decline }),
    ).toBeDisabled();

    await waitFor(() => {
      expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js");
    });

    expect(serviceWorker.subscribe).not.toHaveBeenCalled();
    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();

    serviceWorker.settleReady();
    await waitFor(() => {
      expect(clientMock.postPushSubscription).toHaveBeenCalledTimes(1);
    });
    expect(serviceWorker.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(clientMock.applicationServerKeyBytes).toHaveBeenCalledWith(
      "BServerKey",
    );

    expect(clientMock.postPushSubscription).toHaveBeenCalledWith({
      endpoint: SUB_ENDPOINT,
      keys: { p256dh: "client-p256dh", auth: "client-auth" },
    });

    await waitFor(() => {
      expect(screen.queryByText(messages.push.title)).toBeNull();
    });

    expect(clientMock.dismissPushPrompt).not.toHaveBeenCalled();
  });
});

describe("decline stamps once and moves focus POSITIONALLY (T-WEB-S268)", () => {
  it("'Agora não' POSTs the dismissal and the card leaves; focus goes to the first control AFTER the card, or — the shipped layout, where the card is the aside's last child — to the nearest control BEFORE it, never to <body> and never backwards past a following control", async () => {
    installSupportedBrowser();
    const shipped = render(
      <aside>
        <a href="/proximo">{messages.conclusion.ctaHome}</a>
        <button type="button">compartilhar</button>
        <a href="/estatisticas">{messages.conclusion.stats}</a>
        <PushPromptCard />
      </aside>,
    );
    await screen.findByText(messages.push.title);

    fireEvent.click(
      screen.getByRole("button", { name: messages.push.decline }),
    );
    expect(clientMock.dismissPushPrompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(messages.push.title)).toBeNull();

    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: messages.conclusion.stats }),
    );

    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();
    shipped.unmount();
    clientMock.dismissPushPrompt.mockClear();
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(window, "PushManager");
    Reflect.deleteProperty(navigator, "serviceWorker");

    installSupportedBrowser();
    render(
      <aside>
        <a href="/proximo">{messages.conclusion.ctaHome}</a>
        <PushPromptCard />
        <a href="/estatisticas">{messages.conclusion.stats}</a>
      </aside>,
    );
    await screen.findByText(messages.push.title);
    fireEvent.click(
      screen.getByRole("button", { name: messages.push.decline }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: messages.conclusion.stats }),
    );
  });
});

describe("denial stamps and ends the card; a transient failure stamps nothing and re-arms it (T-WEB-S269)", () => {
  it("a subscribe rejection with permission now 'denied' POSTs the permanent dismissal and the card leaves; the same rejection with permission still 'default' stamps nothing and the card returns to its enabled state", async () => {
    const notification = installNotification("default");
    installPushManager();
    const denied = installServiceWorker({ subscribeRejects: true });
    const deniedView = await renderShownCard();
    fireEvent.click(screen.getByRole("button", { name: messages.push.accept }));
    notification.permission = "denied";
    denied.settleReady();
    await waitFor(() => {
      expect(clientMock.dismissPushPrompt).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByText(messages.push.title)).toBeNull();
    });
    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();
    deniedView.unmount();
    clientMock.dismissPushPrompt.mockClear();
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(window, "PushManager");
    Reflect.deleteProperty(navigator, "serviceWorker");

    installNotification("default");
    installPushManager();
    const transient = installServiceWorker({ subscribeRejects: true });
    await renderShownCard();
    fireEvent.click(screen.getByRole("button", { name: messages.push.accept }));
    expect(
      screen.getByRole("button", { name: messages.push.accept }),
    ).toBeDisabled();
    transient.settleReady();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: messages.push.accept }),
      ).toBeEnabled();
    });
    expect(screen.getByText(messages.push.title)).toBeVisible();
    expect(transient.subscribe).toHaveBeenCalled();
    expect(clientMock.dismissPushPrompt).not.toHaveBeenCalled();
    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();
  });
});

describe("a stored-nothing accept unwinds the browser subscription (T-WEB-S271)", () => {
  it("a failed POST unsubscribes, stamps nothing and re-arms the card; a keyless subscription is unwound the same way with no POST at all — browser and server can never permanently disagree", async () => {
    clientMock.postPushSubscription.mockResolvedValueOnce(false);
    const failed = installSupportedBrowser();
    const failedView = await renderShownCard();
    fireEvent.click(screen.getByRole("button", { name: messages.push.accept }));
    failed.serviceWorker.settleReady();
    await waitFor(() => {
      expect(failed.serviceWorker.unsubscribe).toHaveBeenCalledTimes(1);
    });
    expect(clientMock.postPushSubscription).toHaveBeenCalledTimes(1);

    expect(clientMock.dismissPushPrompt).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: messages.push.accept }),
      ).toBeEnabled();
    });
    failedView.unmount();
    clientMock.postPushSubscription.mockClear();
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(window, "PushManager");
    Reflect.deleteProperty(navigator, "serviceWorker");

    installNotification("default");
    installPushManager();
    const keyless = installServiceWorker({ keylessSubscription: true });
    await renderShownCard();
    fireEvent.click(screen.getByRole("button", { name: messages.push.accept }));
    keyless.settleReady();
    await waitFor(() => {
      expect(keyless.unsubscribe).toHaveBeenCalledTimes(1);
    });
    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();
    expect(clientMock.dismissPushPrompt).not.toHaveBeenCalled();
  });
});

describe("the push strings are externalised pt-BR with the settled vocabulary (T-WEB-S270)", () => {
  it("messages.push.* carries the four strings the card renders, in CONTEXT.md's words — sequência, virada, lembrete — and no aria string exists to drift", () => {
    expect(messages.push.title).toContain("sequência");
    expect(messages.push.body).toContain("virada");
    expect(messages.push.body).toContain("sequência");
    expect(messages.push.body).toContain("lembrete");
    expect(messages.push.accept).toContain("lembrete");
    expect(messages.push.decline).toBe("Agora não");

    expect(Object.keys(messages.push).sort()).toEqual([
      "accept",
      "body",
      "decline",
      "title",
    ]);
  });
});
