import {
  applicationServerKeyBytes,
  deletePushSubscription,
  postPushSubscription,
} from "./push-client";

export function browserSupportsPush(): boolean {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export type SubscribeOutcome = "stored" | "denied" | "retriable";

export async function subscribeAndStore(
  vapidPublicKey: string,
): Promise<SubscribeOutcome> {
  let subscription: PushSubscription;
  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKeyBytes(vapidPublicKey),
    });
  } catch {
    return Notification.permission === "denied" ? "denied" : "retriable";
  }
  const json = subscription.toJSON();
  const p256dh = json.keys?.["p256dh"];
  const auth = json.keys?.["auth"];

  const stored =
    p256dh !== undefined && auth !== undefined && p256dh !== "" && auth !== ""
      ? await postPushSubscription({
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
        })
      : false;
  if (!stored) {
    await subscription.unsubscribe().catch(() => false);
    return "retriable";
  }
  return "stored";
}

export type UnsubscribeOutcome = "forgotten" | "kept" | "stranded";

export async function unsubscribeAndForget(
  subscription: PushSubscription,
): Promise<UnsubscribeOutcome> {
  if (!(await deletePushSubscription(subscription.endpoint))) {
    return "kept";
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await subscription.unsubscribe().catch(() => false)) {
      return "forgotten";
    }
  }
  return "stranded";
}
