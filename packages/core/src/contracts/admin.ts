import { z } from "zod";

import { attachEmailSchema } from "./attach";
import {
  remoteConfigField,
  remoteConfigKeySchema,
  remoteConfigSchema,
} from "../remote-config";

export const adminConfigValuesSchema = remoteConfigSchema.strict().required();

export const ADMIN_MEMBER_ROLES = ["superuser", "admin"] as const;
export const adminMemberRoleSchema = z.enum(ADMIN_MEMBER_ROLES);
export type AdminMemberRole = z.infer<typeof adminMemberRoleSchema>;

export const adminMemberSchema = z.strictObject({
  email: z.email(),
  role: adminMemberRoleSchema,
});
export type AdminMember = z.infer<typeof adminMemberSchema>;

export const adminStateResponseSchema = z.discriminatedUnion("role", [
  z.strictObject({ role: z.literal("none"), email: z.email().nullable() }),
  z.strictObject({
    role: z.literal("admin"),
    email: z.email(),
    config: adminConfigValuesSchema,
  }),
  z.strictObject({
    role: z.literal("superuser"),
    email: z.email(),
    config: adminConfigValuesSchema,
    members: z.array(adminMemberSchema),
  }),
]);
export type AdminStateResponse = z.infer<typeof adminStateResponseSchema>;

export const adminConfigWriteSchema = z
  .strictObject({
    key: remoteConfigKeySchema,
    value: z.union([z.number(), z.boolean()]),
  })
  .refine(({ key, value }) => remoteConfigField(key).safeParse(value).success);
export type AdminConfigWriteRequest = z.infer<typeof adminConfigWriteSchema>;

export const adminMemberWriteSchema = z.strictObject({
  email: attachEmailSchema,
  role: adminMemberRoleSchema,
});

export const adminMemberRemoveSchema = z.strictObject({
  email: attachEmailSchema,
});
