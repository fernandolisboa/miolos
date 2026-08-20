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

// The push pre-prompt card (#145, ADR-0064, plan 061 §5): server-owned
// eligibility, browser-owned support/permission/subscription gates, one
// permanent dismissal. Every assertion goes through the messages module —
// never string literals. jsdom has no ServiceWorker/PushManager/
// Notification, so the browser APIs are DEFINED on window/navigator per
// test (define, not mock-import) — which also makes "absent" the honest
// default for T-WEB-S266.

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

// `ensureSession` is stubbed by SPREADING the real module (the
// hub-onboarding suite's importOriginal discipline): the hook must await
// the mint, and T-WEB-S264 drives the stub as a deferred promise to prove
// the ordering. Everything else bootstrap exports stays real.
const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

const SUB_ENDPOINT = "https://push.example.org/send/this-install";

// usePushState's contract wants a MODULE-LEVEL predicate (a per-render
// closure would re-run the effect on every state settle — the hook's own
// doc says so), so the hook arms use these two rather than inline arrows.
const FETCH_ENABLED = () => true;
const FETCH_DISABLED = () => false;

/** A mutable Notification stand-in — `permission` flips per scenario. */
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

/**
 * A serviceWorker stand-in whose `ready` is a deferred promise and whose
 * registration REJECTS `subscribe` until `ready` has settled — the Push
 * API's own InvalidStateError semantics, so a register→subscribe shortcut
 * (skipping the `ready` wait) FAILS here exactly as it fails on a first
 * visit in a real browser (plan 061 §2; T-WEB-S267's anti-shortcut stub).
 */
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

/** All three APIs present, permission default, no subscription — the happy browser. */
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

/** Render the card and wait for both gates (server + browser) to open it. */
async function renderShownCard() {
  const view = render(<PushPromptCard />);
  await screen.findByText(messages.push.title);
  return view;
}

describe("usePushState awaits the mint and keeps three honest states (T-WEB-S264)", () => {
  it("the state fetch is NOT issued until ensureSession resolves, and the hook answers undefined → value/null honestly", async () => {
    // A deferred mint (the T-WEB-S250 shape): a direct /concluido load can
    // race the layout's own POST /session into a 401.
    let releaseMint = (): void => undefined;
    bootstrapMock.ensureSession.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseMint = resolve;
      }),
    );

    const { result } = renderHook(() => usePushState(FETCH_ENABLED));
    // Nothing has settled: the honest first state.
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

    // Settled without a value (env unset, non-200, network, parse): null —
    // the card stays absent; an unreachable server must never nag.
    clientMock.fetchNotificationsState.mockResolvedValue(undefined);
    const failed = renderHook(() => usePushState(FETCH_ENABLED));
    await waitFor(() => {
      expect(failed.result.current).toBeNull();
    });

    // And the other half of the seam (step-6 performance 1): disabled means
    // NO mint and NO fetch — the card's suppression cases assert this
    // end-to-end (T-WEB-S265/S266); this arm pins the hook's own switch.
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
    // The server render is EMPTY: no push markup exists before hydration,
    // so first paint and detect's clean profile are unchanged.
    expect(renderToStaticMarkup(<PushPromptCard />)).toBe("");

    // Positive control: everything yes → the card, both actions on it.
    installSupportedBrowser();
    const shown = await renderShownCard();
    expect(
      screen.getByRole("button", { name: messages.push.accept }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: messages.push.decline }),
    ).toBeVisible();
    // The a11y shape: a named section, the name from the rendered title.
    const section = screen.getByRole("region", {
      name: messages.push.title,
    });
    expect(section).toBeVisible();
    shown.unmount();

    // Server says ineligible → nothing (the decision stays server-owned).
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

    // A null key with eligible true (a contract-legal shape no healthy
    // server emits) → nothing: an accept with no key cannot subscribe.
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

    // Permission already granted or denied → never re-ask — AND never pay
    // for the answer (step-6 performance 1): an already-answered browser
    // fires NO credentialed GET, so exactly the accounts that accepted (the
    // longest-history ones) stop funding an unbounded streak read per
    // conclusion. The card-visible arms above are the positive control that
    // the fetch DOES fire when these gates pass.
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
      // Two microtask turns: room for a wrongly-scheduled fetch chain to
      // surface before the negative assertions.
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

    // This browser already holds a subscription → nothing to ask.
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
    // jsdom ships none of the three, so absence is the honest default and
    // each case installs exactly the other two legs. The fetch-suppression
    // half (step-6 performance 1): an unsupported browser structurally
    // cannot render the card, so it must not pay a per-conclusion state
    // request either — iOS Safari uninstalled is a large slice of a pt-BR
    // mobile audience. T-WEB-S265's all-yes control proves the fetch DOES
    // fire when every leg is present, so these negatives are non-vacuous.

    // Leg 1 absent: window.Notification (with Push support present, which
    // real iOS never ships — the point is the guard order, not realism).
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

    // Leg 2 absent: navigator.serviceWorker (non-secure contexts and some
    // private windows) — touching it would throw; the detect must come
    // first.
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

    // Leg 3 absent: window.PushManager (Notification without Web Push).
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
    // The card STAYS while the flow is in flight (step-7, correctness F4):
    // its copy is the browser permission prompt's only on-screen framing,
    // so it must not vanish before the dialog it explains can appear. Both
    // buttons are inert meanwhile.
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
    // `ready` has not settled: subscribe must NOT have fired — the stub
    // would reject it (the InvalidStateError shortcut), so this assertion
    // plus the successful POST below pin the ordering from both sides.
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
    // The POST carries the browser's own subscription, endpoint + keys.
    expect(clientMock.postPushSubscription).toHaveBeenCalledWith({
      endpoint: SUB_ENDPOINT,
      keys: { p256dh: "client-p256dh", auth: "client-auth" },
    });
    // …and only NOW, with the flow settled and stored, the card leaves.
    await waitFor(() => {
      expect(screen.queryByText(messages.push.title)).toBeNull();
    });
    // Accept stamps NOTHING: the dismissal is decline's and denial's.
    expect(clientMock.dismissPushPrompt).not.toHaveBeenCalled();
  });
});

describe("decline stamps once and moves focus POSITIONALLY (T-WEB-S268)", () => {
  it("'Agora não' POSTs the dismissal and the card leaves; focus goes to the first control AFTER the card, or — the shipped layout, where the card is the aside's last child — to the nearest control BEFORE it, never to <body> and never backwards past a following control", async () => {
    // The shipped layout's shape (step-6 correctness F2 / quality 2): the
    // realistic aside — controls ABOVE the card (the CTA, the share button,
    // the stats link) and the card LAST. The old first-non-card-match walk
    // would land on the CTA (the aside's first control); the positional
    // walk lands on the stats link, the control adjacent to where the card
    // just was.
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
    // The #67 class of focus-order failure, closed — and closed in the
    // right DIRECTION: the nearest preceding control, not the column's
    // first.
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: messages.conclusion.stats }),
    );
    // Decline never touches the browser permission machinery.
    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();
    shipped.unmount();
    clientMock.dismissPushPrompt.mockClear();
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(window, "PushManager");
    Reflect.deleteProperty(navigator, "serviceWorker");

    // And when a control DOES follow the card, it wins over every
    // preceding one — the "first focusable after the card" half of the
    // claim, which the old walk satisfied only by accident of the layout.
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
    // Denial: the browser prompt was refused mid-flow.
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
    // A denied browser is terminal: the card leaves after the stamp.
    await waitFor(() => {
      expect(screen.queryByText(messages.push.title)).toBeNull();
    });
    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();
    deniedView.unmount();
    clientMock.dismissPushPrompt.mockClear();
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(window, "PushManager");
    Reflect.deleteProperty(navigator, "serviceWorker");

    // Transient (network blip, a pushService 5xx): permission is still
    // "default", so NOTHING is stamped. The POSITIVE post-condition (the
    // step-6 F5 de-vacuation): the catch's own outcome is observable — the
    // card re-arms, its buttons live again for an in-place retry — so the
    // no-stamp assertions below cannot pass vacuously on a path that never
    // ran.
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
    // The dead-end this closes (step-6 correctness F1): subscribe()
    // succeeded — permission is now "granted" — but the server holds no
    // row. Without the unwind, both render gates (permission === "default",
    // no local subscription) exclude this install FOREVER while
    // GET /notifications/state keeps answering eligible: an opt-in the
    // player performed that can never deliver and that nothing can repair
    // until #36. Unwinding makes browser and server agree again.

    // Arm 1: the POST fails (network flake, 401 after cookie expiry, 5xx).
    clientMock.postPushSubscription.mockResolvedValueOnce(false);
    const failed = installSupportedBrowser();
    const failedView = await renderShownCard();
    fireEvent.click(screen.getByRole("button", { name: messages.push.accept }));
    failed.serviceWorker.settleReady();
    await waitFor(() => {
      expect(failed.serviceWorker.unsubscribe).toHaveBeenCalledTimes(1);
    });
    expect(clientMock.postPushSubscription).toHaveBeenCalledTimes(1);
    // No stamp: the player did not decline, and the browser did not deny.
    expect(clientMock.dismissPushPrompt).not.toHaveBeenCalled();
    // Re-armed, not gone: with permission granted, a retry is a silent
    // one-click re-subscribe — no second browser prompt.
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

    // Arm 2: the browser hands back a subscription without its keys — a
    // row the dispatcher could never send to (the strict contract would
    // 400 it). Never posted, and unwound all the same.
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
    // Exactly the four keys: the card's accessible name comes from the
    // rendered title via aria-labelledby, so no fifth aria string may
    // appear for the copy to drift from (the onboarding block's shape).
    expect(Object.keys(messages.push).sort()).toEqual([
      "accept",
      "body",
      "decline",
      "title",
    ]);
  });
});
