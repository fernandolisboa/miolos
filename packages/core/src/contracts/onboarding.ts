import { z } from "zod";

/**
 * The onboarding contracts (#35, ADR-0061): the first-visit introduction's
 * server-owned "seen once" fact, read back as one derived boolean and
 * stamped by one empty-bodied POST — the attach.ts register throughout.
 *
 * Every schema here is STRICT ON BOTH ENDS (the streak.ts register): the
 * route parses before `Response.json`, and the web client strict-parses the
 * GET's body (`markOnboardingSeen` reads only `response.ok` and discards
 * the POST body — the dismissAttachPrompt precedent). So future payload
 * growth MUST arrive as a new endpoint and contract — an appended field
 * would fail every deployed client's parse (ADR-0048's rule).
 */

/**
 * Response of GET /onboarding/state — ONE derived boolean, nothing else.
 * `show`, not `seen`: the server owns the whole decision and the client is
 * a dumb renderer (GET /attach/state's `eligible` in the same posture).
 * The timestamp itself never ships to the client (ADR-0048 decision 3).
 */
export const onboardingStateResponseSchema = z.strictObject({
  show: z.boolean(),
});
export type OnboardingStateResponse = z.infer<
  typeof onboardingStateResponseSchema
>;

/**
 * Body of POST /onboarding/seen — the strict EMPTY object (attach/dismiss's
 * shape): the client posts a literal `{}` and any key is a 400.
 */
export const onboardingSeenSchema = z.strictObject({});
export type OnboardingSeenRequest = z.infer<typeof onboardingSeenSchema>;

export const onboardingSeenResponseSchema = z.strictObject({
  seen: z.literal(true),
});
export type OnboardingSeenResponse = z.infer<
  typeof onboardingSeenResponseSchema
>;
