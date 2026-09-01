import type { ZodType } from "zod";

export function apiBaseUrl(absence: string): string | undefined {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(`NEXT_PUBLIC_API_URL is unset: ${absence}`);
    return undefined;
  }
  return url;
}

export async function apiGet<T>(
  path: string,
  schema: ZodType<T>,
  absence: string,
): Promise<T | undefined> {
  const base = apiBaseUrl(absence);
  if (!base) {
    return undefined;
  }
  try {
    const response = await fetch(`${base}${path}`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function apiPostRaw(
  path: string,
  body: unknown,
  absence: string,
): Promise<Response | undefined> {
  const base = apiBaseUrl(absence);
  if (!base) {
    return undefined;
  }
  try {
    return await fetch(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return undefined;
  }
}

export async function apiPost(
  path: string,
  body: unknown,
  absence: string,
): Promise<boolean> {
  return (await apiPostRaw(path, body, absence))?.ok === true;
}
