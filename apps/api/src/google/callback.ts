import {
  googleCallbackQuerySchema,
  type GoogleSignInOutcome,
} from "@miolos/core";
import type { Db } from "@miolos/db";

import {
  createSessionForUser,
  deleteSession,
  requireUserId,
} from "../session/service";
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
  try {
    const resolved = await resolveGoogleSignIn(
      db,
      await requireUserId(db, presented),
      sub,
    );
    if (resolved.outcome === "conflict") {
      return { outcome: "conflict" };
    }
    const sessionToken = generateSessionToken();
    await createSessionForUser(
      db,
      await hashSessionToken(sessionToken),
      resolved.userId,
    );
    if (presented !== undefined) {
      await deleteSession(db, await hashSessionToken(presented));
    }
    return { outcome: resolved.outcome, sessionToken };
  } catch (error) {
    console.error("google callback: sign-in failed", error);
    return { outcome: "failed" };
  }
}
