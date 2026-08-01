/**
 * Opaque session token primitives (ADR-0022). Web Crypto only — no Node
 * import — so the module is edge-safe by construction.
 */

/** 32 random bytes (256 bits, above the 128-bit floor), base64url. */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * SHA-256, lowercase hex. The server stores and looks up only this hash;
 * lookup-by-hash means no timing-sensitive comparison exists anywhere.
 */
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
