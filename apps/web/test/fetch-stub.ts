import { vi } from "vitest";

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

export function stubFetch(respond: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(() => Promise.resolve(respond()));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function stubSessionFetch(
  respond: (attempt: number) => Response | Promise<Response>,
) {
  let attempt = 0;
  const fetchMock = vi.fn((...args: unknown[]) => {
    if (String(args[0]).endsWith("/session")) {
      return Promise.resolve(
        jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
      );
    }
    attempt += 1;
    try {
      return Promise.resolve(respond(attempt));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error("nope"));
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
