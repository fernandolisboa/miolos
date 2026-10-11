import {
  googleIdTokenClaimsSchema,
  googleTokenResponseSchema,
} from "@miolos/core";

import { generateSessionToken } from "../session/token";

const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EXCHANGE_TIMEOUT_MS = 10_000;

export const FLOW_COOKIE_NAME = "__Host-miolos_google";
const FLOW_MAX_AGE_SECONDS = 600;

export type GoogleClient = { clientId: string; clientSecret: string };

export function googleClient(): GoogleClient | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !process.env.WEB_ORIGIN) {
    return undefined;
  }
  return { clientId, clientSecret };
}

export function callbackUrl(apiOrigin: string): string {
  return new URL("/auth/google/callback", apiOrigin).toString();
}

export type Flow = { state: string; verifier: string };

export function startFlow(): Flow {
  return {
    state: generateSessionToken(),
    verifier: generateSessionToken(),
  };
}

// The __Host- prefix stops a sibling subdomain planting a flow of its own.
export function buildFlowCookie(flow: Flow): string {
  return `${FLOW_COOKIE_NAME}=${flow.state}.${flow.verifier}; Path=/; Max-Age=${FLOW_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function buildFlowClearingCookie(): string {
  return `${FLOW_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

const FLOW_COOKIE_VALUE = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/;

export function readFlowCookie(value: string | undefined): Flow | undefined {
  const [, state, verifier] = FLOW_COOKIE_VALUE.exec(value ?? "") ?? [];
  if (state === undefined || verifier === undefined) {
    return undefined;
  }
  return { state, verifier };
}

function base64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

export async function buildAuthorizeUrl(
  client: GoogleClient,
  redirectUri: string,
  flow: Flow,
): Promise<string> {
  const challenge = base64url(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(flow.verifier),
    ),
  );
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid",
    state: flow.state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export async function exchangeCode(
  client: GoogleClient,
  init: { code: string; redirectUri: string; verifier: string },
): Promise<string | undefined> {
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: init.code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: init.redirectUri,
        code_verifier: init.verifier,
      }),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = googleTokenResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.id_token : undefined;
  } catch {
    return undefined;
  }
}

// The ID token arrives straight from Google's token endpoint over TLS, which
// stands in for the signature check (OpenID Connect Core 3.1.3.7, rule 6).
export function googleSubject(
  idToken: string,
  expected: { clientId: string; nowSeconds: number },
): string | undefined {
  const payload = idToken.split(".")[1];
  if (payload === undefined) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  const claims = googleIdTokenClaimsSchema.safeParse(raw);
  if (
    !claims.success ||
    claims.data.aud !== expected.clientId ||
    claims.data.exp <= expected.nowSeconds
  ) {
    return undefined;
  }
  return claims.data.sub;
}
