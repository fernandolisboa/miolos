import { z } from "zod";

/**
 * The onboarding contracts (ADR-0061): the first-visit introduction's
 * server-owned "seen once" fact, read back as one derived boolean and
 * stamped by one empty-bodied POST.
 *
 * Every schema here is strict on both ends (the streak.ts register): the
 * route parses before `Response.json`, and the web client strict-parses the
 * GET's body, so future payload growth must arrive as a new endpoint and
 * contract, never an appended field.
 */

/**
 * Response of GET /onboarding/state — one derived boolean, nothing else.
 * `show`, not `seen`: the server owns the whole decision and the client is
 * a dumb renderer. The timestamp itself never ships to the client.
 */
export const onboardingStateResponseSchema = z.strictObject({
  show: z.boolean(),
});
export type OnboardingStateResponse = z.infer<
  typeof onboardingStateResponseSchema
>;

/** Body of POST /onboarding/seen — the strict empty object: the client
 *  posts a literal `{}` and any key is a 400. */
export const onboardingSeenSchema = z.strictObject({});
export type OnboardingSeenRequest = z.infer<typeof onboardingSeenSchema>;

export const onboardingSeenResponseSchema = z.strictObject({
  seen: z.literal(true),
});
export type OnboardingSeenResponse = z.infer<
  typeof onboardingSeenResponseSchema
>;
