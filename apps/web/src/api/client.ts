import type { ZodType } from "zod";

export function apiBaseUrl(absence: string): string | undefined {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    console.error(`NEXT_PUBLIC_API_URL is unset: ${absence}`);
    return undefined;
  }
  return url;
}

// Every failure path answers undefined: see ADR-0072 consequence (j).
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

export async function postJson(
  url: string,
  body: string,
): Promise<Response | undefined> {
  try {
    return await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    });
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
  return await postJson(`${base}${path}`, JSON.stringify(body));
}

export async function apiPost(
  path: string,
  body: unknown,
  absence: string,
): Promise<boolean> {
  return (await apiPostRaw(path, body, absence))?.ok === true;
}
