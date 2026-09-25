import { z } from "zod";

export const notificationsStateResponseSchema = z.strictObject({
  eligible: z.boolean(),
  vapidPublicKey: z.string().nullable(),
});
export type NotificationsStateResponse = z.infer<
  typeof notificationsStateResponseSchema
>;

export const pushSubscribeSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.strictObject({
    p256dh: z.string().min(1).max(128),
    auth: z.string().min(1).max(128),
  }),
});
export type PushSubscribeRequest = z.infer<typeof pushSubscribeSchema>;

export const pushSubscribeResponseSchema = z.strictObject({
  subscribed: z.literal(true),
});
export type PushSubscribeResponse = z.infer<typeof pushSubscribeResponseSchema>;

export const pushUnsubscribeSchema = z.strictObject({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
});
export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeSchema>;

export const pushUnsubscribeResponseSchema = z.strictObject({
  removed: z.literal(true),
});
export type PushUnsubscribeResponse = z.infer<
  typeof pushUnsubscribeResponseSchema
>;

export const pushNudgePayloadSchema = z.strictObject({
  title: z.string().min(1),
  body: z.string().min(1),
});
export type PushNudgePayload = z.infer<typeof pushNudgePayloadSchema>;

export const streakReminderSchema = z.strictObject({
  to: z.email(),
  streak: z.number().int().min(1),
});
export type StreakReminder = z.infer<typeof streakReminderSchema>;

export const notificationsDismissSchema = z.strictObject({});
export type NotificationsDismissRequest = z.infer<
  typeof notificationsDismissSchema
>;

export const notificationsDismissResponseSchema = z.strictObject({
  dismissed: z.literal(true),
});
export type NotificationsDismissResponse = z.infer<
  typeof notificationsDismissResponseSchema
>;
