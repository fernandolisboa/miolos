import { z } from "zod";

export const onboardingStateResponseSchema = z.strictObject({
  show: z.boolean(),
});
export type OnboardingStateResponse = z.infer<
  typeof onboardingStateResponseSchema
>;

export const onboardingSeenSchema = z.strictObject({});
export type OnboardingSeenRequest = z.infer<typeof onboardingSeenSchema>;

export const onboardingSeenResponseSchema = z.strictObject({
  seen: z.literal(true),
});
export type OnboardingSeenResponse = z.infer<
  typeof onboardingSeenResponseSchema
>;
