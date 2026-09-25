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
    return response.ok ? await parseJsonResponse(response, schema) : undefined;
  } catch {
    return undefined;
  }
}

export async function parseJsonResponse<T>(
  response: Response,
  schema: ZodType<T>,
): Promise<T | undefined> {
  try {
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

type JsonMethod = "POST" | "DELETE";

async function sendJson(
  method: JsonMethod,
  url: string,
  body: string,
): Promise<Response | undefined> {
  try {
    return await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return undefined;
  }
}

export async function postJson(
  url: string,
  body: string,
): Promise<Response | undefined> {
  return await sendJson("POST", url, body);
}

async function apiSend(
  method: JsonMethod,
  path: string,
  body: unknown,
  absence: string,
): Promise<Response | undefined> {
  const base = apiBaseUrl(absence);
  if (!base) {
    return undefined;
  }
  let payload: string;
  try {
    payload = JSON.stringify(body);
  } catch {
    return undefined;
  }
  return await sendJson(method, `${base}${path}`, payload);
}

export async function apiPostRaw(
  path: string,
  body: unknown,
  absence: string,
): Promise<Response | undefined> {
  return await apiSend("POST", path, body, absence);
}

export async function apiPostParsed<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
  absence: string,
): Promise<T | undefined> {
  const response = await apiPostRaw(path, body, absence);
  return response?.ok ? await parseJsonResponse(response, schema) : undefined;
}

export async function apiPost(
  path: string,
  body: unknown,
  absence: string,
): Promise<boolean> {
  return (await apiPostRaw(path, body, absence))?.ok === true;
}

export async function apiDelete(
  path: string,
  body: unknown,
  absence: string,
): Promise<boolean> {
  return (await apiSend("DELETE", path, body, absence))?.ok === true;
}
