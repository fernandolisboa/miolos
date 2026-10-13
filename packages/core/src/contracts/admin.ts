import { z } from "zod";

import {
  remoteConfigField,
  remoteConfigKeySchema,
  remoteConfigSchema,
} from "../remote-config";

export const adminConfigValuesSchema = remoteConfigSchema.strict().required();

export const adminStateResponseSchema = z.strictObject({
  userId: z.uuid(),
  config: adminConfigValuesSchema.nullable(),
});
export type AdminStateResponse = z.infer<typeof adminStateResponseSchema>;

export const adminConfigWriteSchema = z
  .strictObject({ key: remoteConfigKeySchema, value: z.number() })
  .refine(({ key, value }) => remoteConfigField(key).safeParse(value).success);
export type AdminConfigWriteRequest = z.infer<typeof adminConfigWriteSchema>;
