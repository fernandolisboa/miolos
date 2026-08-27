import type { PushNudgePayload } from "@miolos/core";
import { sendNotification, setVapidDetails, WebPushError } from "web-push";

export type SendResult = { ok: true } | { ok: false; statusCode?: number };

export type NudgeSend = (
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushNudgePayload,
) => Promise<SendResult>;

export const sendWebPush: NudgeSend = async (subscription, payload) => {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    return { ok: false };
  }
  try {
    setVapidDetails(subject, publicKey, privateKey);
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600 },
    );
    return { ok: true };
  } catch (thrown) {
    if (thrown instanceof WebPushError) {
      return { ok: false, statusCode: thrown.statusCode };
    }
    return { ok: false };
  }
};
