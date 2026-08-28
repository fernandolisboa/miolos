export const SESSION_COOKIE_NAME = "miolos_session";

const MAX_AGE_SECONDS = 34_560_000;

export function buildSessionCookie(token: string): string {
  const cookieDomain = process.env.COOKIE_DOMAIN;
  let cookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`;
  if (cookieDomain) {
    cookie += `; Domain=${cookieDomain}`;
  }
  if (cookieDomain || process.env.NODE_ENV === "production") {
    cookie += "; Secure";
  }
  return cookie;
}

export function buildSessionClearingCookie(): string {
  const cookieDomain = process.env.COOKIE_DOMAIN;
  let cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  if (cookieDomain) {
    cookie += `; Domain=${cookieDomain}`;
  }
  if (cookieDomain || process.env.NODE_ENV === "production") {
    cookie += "; Secure";
  }
  return cookie;
}
