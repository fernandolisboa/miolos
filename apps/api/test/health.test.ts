import { healthResponseSchema } from "@miolos/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/health/route";

describe("GET /health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 with a payload the shared Zod contract accepts", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    const parsed = healthResponseSchema.parse(body);
    expect(parsed.status).toBe("ok");
    expect(parsed.service).toBe("api");
  });

  it("echoes WEB_ORIGIN in Access-Control-Allow-Origin when set", () => {
    vi.stubEnv("WEB_ORIGIN", "https://example.test");
    const response = GET();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.test",
    );
  });

  it("omits the CORS header entirely when WEB_ORIGIN is unset", () => {
    vi.stubEnv("WEB_ORIGIN", undefined);
    const response = GET();
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
});
