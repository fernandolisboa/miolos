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
  outcome: "ok" | "switched" | "failed" | "conflict";
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
  if (!flow || !callback.code || callback.state !== flow.state) {
    return { outcome: "failed" };
  }

  const idToken = await exchangeCode(client, {
    code: callback.code,
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
    // A fresh session every time: a token someone else may know never ends
    // up on the Google account (ADR-0089).
    if (presented !== undefined) {
      await deleteSession(db, await hashSessionToken(presented));
    }
    const sessionToken = generateSessionToken();
    await createSessionForUser(
      db,
      await hashSessionToken(sessionToken),
      resolved.userId,
    );
    return { outcome: resolved.outcome, sessionToken };
  } catch (error) {
    console.error("google callback: sign-in failed", error);
    return { outcome: "failed" };
  }
}
