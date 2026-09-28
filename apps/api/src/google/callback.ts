import {
  googleCallbackQuerySchema,
  type GoogleSignInOutcome,
} from "@miolos/core";
import type { Db } from "@miolos/db";

import { requireUserId, sessionExists } from "../session/service";
import { generateSessionToken, hashSessionToken } from "../session/token";
import {
  callbackUrl,
  exchangeCode,
  googleSubject,
  readFlowCookie,
  type GoogleClient,
} from "./oauth";
import { resolveGoogleSignIn } from "./service";

export type Completion = {
  outcome: GoogleSignInOutcome;
  sessionToken?: string;
};

export async function completeGoogleSignIn(
  db: Db,
  client: GoogleClient,
  callback: {
    apiOrigin: string;
    code: string | null;
    state: string | null;
    flowCookie: string | undefined;
    sessionCookie: string | undefined;
  },
): Promise<Completion> {
  const flow = readFlowCookie(callback.flowCookie);
  const query = googleCallbackQuerySchema.safeParse({
    code: callback.code,
    state: callback.state,
  });
  if (!flow || !query.success || query.data.state !== flow.state) {
    return { outcome: "failed" };
  }

  const idToken = await exchangeCode(client, {
    code: query.data.code,
    redirectUri: callbackUrl(callback.apiOrigin),
    verifier: flow.verifier,
  });
  const sub =
    idToken === undefined
      ? undefined
      : googleSubject(idToken, {
          clientId: client.clientId,
          nowSeconds: Math.floor(Date.now() / 1000),
        });
  if (sub === undefined) {
    return { outcome: "failed" };
  }

  const presented = callback.sessionCookie;
  const sessionToken = generateSessionToken();
  const freshHash = await hashSessionToken(sessionToken);
  let outcome: GoogleSignInOutcome;
  try {
    outcome = await resolveGoogleSignIn(db, sub, {
      requesterId: await requireUserId(db, presented),
      presentedHash:
        presented === undefined ? undefined : await hashSessionToken(presented),
      freshHash,
    });
  } catch (error) {
    console.error("google callback: sign-in failed", error);
    outcome = "failed";
  }
  return (await sessionExists(db, freshHash))
    ? { outcome, sessionToken }
    : { outcome };
}
