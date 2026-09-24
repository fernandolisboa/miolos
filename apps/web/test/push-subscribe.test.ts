import { beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeAndStore, unsubscribeAndForget } from "../src/push/subscribe";
import { webCodeOf, webSources } from "./ts-source";

const clientMock = vi.hoisted(() => ({
  postPushSubscription: vi.fn(() => Promise.resolve(true)),
  deletePushSubscription: vi.fn(() => Promise.resolve(true)),
  dismissPushPrompt: vi.fn(() => Promise.resolve(true)),
  applicationServerKeyBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
}));
vi.mock("../src/push/push-client", () => clientMock);

const ENDPOINT = "https://push.example.org/send/this-install";

function fakeSubscription(unsubscribe: () => Promise<boolean>) {
  return { endpoint: ENDPOINT, unsubscribe: vi.fn(unsubscribe) };
}

function installDeniedBrowser(): void {
  Object.defineProperty(window, "Notification", {
    value: { permission: "denied" },
    configurable: true,
    writable: true,
  });
  const registration = {
    pushManager: {
      subscribe: vi.fn(() => Promise.reject(new Error("NotAllowedError"))),
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      register: vi.fn(() => Promise.resolve(registration)),
      ready: Promise.resolve(registration),
    },
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  clientMock.deletePushSubscription.mockImplementation(() =>
    Promise.resolve(true),
  );
});

describe("one subscribe path for the card and the settings toggle, and only the card dismisses (T-WEB-S402)", () => {
  it("a denied subscribe answers denied and stamps nothing on the server", async () => {
    installDeniedBrowser();
    expect(await subscribeAndStore("BKey")).toBe("denied");
    expect(clientMock.dismissPushPrompt).not.toHaveBeenCalled();
    expect(clientMock.postPushSubscription).not.toHaveBeenCalled();
  });

  it("the card and the toggle both call subscribeAndStore, and nothing else subscribes", () => {
    const callers = webSources()
      .filter((file) => webCodeOf(file).includes("subscribeAndStore("))
      .sort();
    expect(callers).toEqual([
      "app/ajustes/push-section.tsx",
      "src/play/push-prompt-card.tsx",
      "src/push/subscribe.ts",
    ]);
    expect(
      webSources().filter((file) =>
        webCodeOf(file).includes("pushManager.subscribe("),
      ),
    ).toEqual(["src/push/subscribe.ts"]);
    expect(webCodeOf("src/push/subscribe.ts")).not.toContain(
      "dismissPushPrompt",
    );
    expect(webCodeOf("app/ajustes/push-section.tsx")).not.toContain(
      "dismissPushPrompt",
    );
  });
});

describe("turning push off forgets on the server first, then in the browser (T-WEB-S403)", () => {
  it("sends the DELETE before unsubscribe and answers forgotten", async () => {
    const order: string[] = [];
    clientMock.deletePushSubscription.mockImplementation(() => {
      order.push("delete");
      return Promise.resolve(true);
    });
    const subscription = fakeSubscription(() => {
      order.push("unsubscribe");
      return Promise.resolve(true);
    });

    expect(
      await unsubscribeAndForget(subscription as unknown as PushSubscription),
    ).toBe("forgotten");
    expect(clientMock.deletePushSubscription).toHaveBeenCalledWith(ENDPOINT);
    expect(order).toEqual(["delete", "unsubscribe"]);
  });

  it("a failed DELETE keeps the browser subscription untouched", async () => {
    clientMock.deletePushSubscription.mockResolvedValue(false);
    const subscription = fakeSubscription(() => Promise.resolve(true));

    expect(
      await unsubscribeAndForget(subscription as unknown as PushSubscription),
    ).toBe("kept");
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("an unsubscribe that fails after the DELETE is retried once, then reported stranded", async () => {
    const recovers = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("InvalidStateError"))
      .mockResolvedValueOnce(true);
    const once = fakeSubscription(recovers);
    expect(
      await unsubscribeAndForget(once as unknown as PushSubscription),
    ).toBe("forgotten");
    expect(recovers).toHaveBeenCalledTimes(2);

    const never = fakeSubscription(() => Promise.resolve(false));
    expect(
      await unsubscribeAndForget(never as unknown as PushSubscription),
    ).toBe("stranded");
    expect(never.unsubscribe).toHaveBeenCalledTimes(2);
  });
});
