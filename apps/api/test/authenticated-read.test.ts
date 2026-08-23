import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const APP = new URL("../app/", import.meta.url);

/** The known eight: both the expected scan result and the loader for it. */
const AUTHENTICATED_GETS: Record<string, () => Promise<object>> = {
  "attach/state/route.ts": () => import("../app/attach/state/route"),
  "day/route.ts": () => import("../app/day/route"),
  "medals/route.ts": () => import("../app/medals/route"),
  "notifications/state/route.ts": () =>
    import("../app/notifications/state/route"),
  "onboarding/state/route.ts": () => import("../app/onboarding/state/route"),
  "stats/calendar/route.ts": () => import("../app/stats/calendar/route"),
  "stats/route.ts": () => import("../app/stats/route"),
  "streak/route.ts": () => import("../app/streak/route"),
};

// Both spellings of the auth marker: the scan has to name the same eight
// routes before and after the envelope moves into the helper it gates.
const AUTH_MARKERS = ["requireUserId", "authenticatedRead"];

async function scanAuthenticatedGets(): Promise<Map<string, string>> {
  const names = (await readdir(APP, { recursive: true }))
    .filter((name) => name.endsWith("route.ts"))
    .sort();
  const found = new Map<string, string>();
  for (const name of names) {
    const source = await readFile(new URL(name, APP), "utf8");
    if (
      source.includes("export function GET(") ||
      source.includes("export async function GET(")
    ) {
      if (AUTH_MARKERS.some((marker) => source.includes(marker))) {
        found.set(name, source);
      }
    }
  }
  return found;
}

const authenticatedGets = await scanAuthenticatedGets();

describe("every authenticated GET goes through one envelope (T-API-S183)", () => {
  it("the authenticated GETs under app/ are exactly the known eight", () => {
    expect([...authenticatedGets.keys()]).toEqual(
      Object.keys(AUTHENTICATED_GETS).sort(),
    );
  });

  it.each([...authenticatedGets])(
    "%s reads nothing off the request — the no-parameter wall, by gate not by prose",
    (_name, source) => {
      // ADR-0004's wall is that an authenticated read takes no parameter. The
      // helper's signature does NOT enforce it: every callback is an arrow
      // function written inside `GET(request)`, so `request` stays in the
      // closure and a route can still reach `searchParams`. This is the
      // tripwire the per-route prose used to be.
      expect(
        [
          "nextUrl",
          "searchParams",
          "request.headers",
          "request.cookies",
          "next/headers",
        ].filter((token) => source.includes(token)),
      ).toEqual([]);
      expect(source.match(/authenticatedRead\(request,/g)).toHaveLength(1);
    },
  );

  it.each([...authenticatedGets])(
    "%s names no response header, CORS grant or Response.json of its own",
    (_name, source) => {
      expect(
        ["Cache-Control", "corsHeaders", "Response.json"].filter((token) =>
          source.includes(token),
        ),
      ).toEqual([]);
    },
  );

  it.each([...authenticatedGets])(
    "%s imports authenticatedRead",
    (_name, source) => {
      expect(source).toMatch(/from "(\.\.\/)+src\/http\/authenticated-read"/);
    },
  );

  it.each(Object.entries(AUTHENTICATED_GETS))(
    "%s exports GET and the dynamic marker, and nothing else",
    async (_name, load) => {
      expect(Object.keys(await load()).sort()).toEqual(["GET", "dynamic"]);
    },
  );
});
