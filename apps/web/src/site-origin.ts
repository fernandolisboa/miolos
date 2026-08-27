const FALLBACK_ORIGIN = "http://localhost:3000";

export function siteOrigin(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_ORIGIN);
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteOrigin()).toString();
}
