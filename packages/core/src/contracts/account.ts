import { z } from "zod";

export const accountDeleteSchema = z.strictObject({
  confirm: z.literal(true),
});
export type AccountDeleteRequest = z.infer<typeof accountDeleteSchema>;

export const accountDeleteResponseSchema = z.strictObject({
  deleted: z.literal(true),
});
export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>;

export const accountStateResponseSchema = z.strictObject({
  email: z.string().nullable(),
  reminderConsent: z.boolean(),
});
export type AccountStateResponse = z.infer<typeof accountStateResponseSchema>;

export const reminderConsentSchema = z.strictObject({
  granted: z.boolean(),
});
export type ReminderConsentRequest = z.infer<typeof reminderConsentSchema>;

export const reminderConsentResponseSchema = z.strictObject({
  reminderConsent: z.boolean(),
});
export type ReminderConsentResponse = z.infer<
  typeof reminderConsentResponseSchema
>;

export const accountDetachEmailSchema = z.strictObject({
  confirm: z.literal(true),
});
export type AccountDetachEmailRequest = z.infer<
  typeof accountDetachEmailSchema
>;

export const accountDetachEmailResponseSchema = z.strictObject({
  detached: z.literal(true),
});
export type AccountDetachEmailResponse = z.infer<
  typeof accountDetachEmailResponseSchema
>;

export const telemetryChoiceSchema = z.strictObject({
  sending: z.boolean(),
});
export type TelemetryChoice = z.infer<typeof telemetryChoiceSchema>;

const GAME_SETTINGS_MAX_CHARS = 4096;
const settingKey = z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,31}$/);
const settingLeaf = z.union([z.boolean(), z.number(), z.string().max(32)]);
const settingGroup = <T extends z.ZodType>(value: T) =>
  z
    .record(settingKey, value)
    .refine((group) => Object.keys(group).length <= 40);

export const gameSettingsPayloadSchema = settingGroup(
  z.union([
    settingLeaf,
    settingGroup(z.union([settingLeaf, settingGroup(settingLeaf)])),
  ]),
).refine(
  (payload) => JSON.stringify(payload).length <= GAME_SETTINGS_MAX_CHARS,
);
export type GameSettingsPayload = z.infer<typeof gameSettingsPayloadSchema>;

export const gameSettingsStateResponseSchema = z.strictObject({
  settings: gameSettingsPayloadSchema.nullable(),
});
export type GameSettingsStateResponse = z.infer<
  typeof gameSettingsStateResponseSchema
>;

export const gameSettingsWriteSchema = z.strictObject({
  settings: gameSettingsPayloadSchema,
});
export type GameSettingsWriteRequest = z.infer<typeof gameSettingsWriteSchema>;

export const gameSettingsWriteResponseSchema = z.strictObject({
  saved: z.literal(true),
});
