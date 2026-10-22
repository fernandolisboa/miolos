// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

import { registerServiceWorkerScript } from "../src/offline/register-script";

const ORIGIN = "https://miolos.test";
const swSource = readFileSync(
  join(import.meta.dirname, "..", "public", "sw.js"),
  "utf8",
);

type Extra = { type?: string; redirected?: boolean };

function served(body: string, init: ResponseInit = {}, extra: Extra = {}) {
  const response = new Response(body, init);
  Object.defineProperties(response, {
    type: { value: extra.type ?? "basic" },
    redirected: { value: extra.redirected ?? false },
    clone: { value: () => served(body, init, extra) },
  });
  return response;
}

const keyOf = (input: string | { url: string }) =>
  typeof input === "string" ? input : input.url;

class FakeCache {
  readonly entries = new Map<string, Response>();
  match(input: string | { url: string }) {
    return Promise.resolve(this.entries.get(keyOf(input))?.clone());
  }
  put(input: string | { url: string }, response: Response) {
    this.entries.set(keyOf(input), response);
    return Promise.resolve();
  }
}

class FakeCaches {
  readonly stores = new Map<string, FakeCache>();
  keys() {
    return Promise.resolve([...this.stores.keys()]);
  }
  open(name: string) {
    const cache = this.stores.get(name) ?? new FakeCache();
    this.stores.set(name, cache);
    return Promise.resolve(cache);
  }
  delete(name: string) {
    return Promise.resolve(this.stores.delete(name));
  }
  async match(input: string | { url: string }) {
    for (const cache of this.stores.values()) {
      const hit = await cache.match(input);
      if (hit) return hit;
    }
    return undefined;
  }
}

type Site = Record<string, () => Response>;

const INDEX = `<html><head><script src="/_next/static/chunks/a.js"></script></head><body>
<a href="/">Miolos</a><a href="/termo">Termo do dia</a><a href="/arquivo">Arquivo</a>
<a href="/modo-livre/termo">Termo</a><a href="/modo-livre/sudoku">Sudoku</a></body></html>`;

function site(overrides: Site = {}): Site {
  return {
    "/modo-livre": () => served(INDEX),
    "/modo-livre/termo": () =>
      served(
        `<link rel="stylesheet" href="/_next/static/chunks/s.css"><script src="/_next/static/chunks/b.js"></script><a href="/">Hub</a>`,
      ),
    "/modo-livre/sudoku": () =>
      served(`<script src="/_next/static/chunks/a.js"></script>`),
    "/_next/static/chunks/a.js": () => served("console.log(1)"),
    "/_next/static/chunks/b.js": () =>
      served(`load(["static/chunks/lazy.js","static/chunks/lazy.css"])`),
    "/_next/static/chunks/lazy.js": () => served("lazy()"),
    "/_next/static/chunks/lazy.css": () => served(".x{}"),
    "/_next/static/chunks/s.css": () =>
      served(
        `@font-face{src:url(../media/f.woff2) format("woff2")}.y{background:url(data:image/png;base64,AA)}`,
      ),
    "/_next/static/media/f.woff2": () => served("font"),
    "/termo": () =>
      served("<p>daily</p>", {
        headers: { "Cache-Control": "private, no-store" },
      }),
    "/": () => served("<p>hub</p>"),
    ...overrides,
  };
}

function worker(initial: Site = site(), saveData = false) {
  const network = { online: true, routes: initial, log: [] as string[] };
  const caches = new FakeCaches();
  const listeners = new Map<string, (event: unknown) => void>();
  const enablePreload = vi.fn(() => Promise.resolve());
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    navigator: { connection: { saveData } },
    registration: {
      navigationPreload: { enable: enablePreload },
      showNotification: () => Promise.resolve(),
    },
    skipWaiting: () => Promise.resolve(),
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, listener);
    },
  };
  const fetch = (input: string | { url: string }) => {
    const url = new URL(keyOf(input));
    network.log.push(url.pathname);
    const route = network.routes[url.pathname];
    if (!network.online) return Promise.reject(new TypeError("offline"));
    return Promise.resolve(route ? route() : served("", { status: 404 }));
  };
  runInContext(
    swSource,
    createContext({ self, caches, fetch, clients: {}, Response, URL }),
  );

  function dispatch(type: string, extra: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    const event = {
      ...extra,
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    };
    listeners.get(type)?.(event);
    return {
      waits,
      response: () => response,
      settled: async () => {
        const result = await response;
        while (waits.length > 0) await waits.shift();
        return result;
      },
    };
  }

  function request(
    path: string,
    {
      mode = "navigate",
      method = "GET",
      preload,
    }: {
      mode?: string;
      method?: string;
      preload?: Promise<Response | undefined>;
    } = {},
  ) {
    const url = path.startsWith("http") ? path : ORIGIN + path;
    return dispatch("fetch", {
      request: { url, method, mode },
      preloadResponse: preload ?? Promise.resolve(undefined),
    });
  }

  const storedKeys = () =>
    [...caches.stores.values()].flatMap((cache) =>
      [...cache.entries.keys()].map((key) => new URL(key).pathname),
    );

  return { network, caches, dispatch, request, storedKeys, enablePreload };
}

async function installed(initial?: Site) {
  const sw = worker(initial);
  await sw.dispatch("install").settled();
  sw.network.log.length = 0;
  return sw;
}

const STORED_SHAPE =
  /^(?:\/modo-livre(?:\/[^/]+)?|\/_next\/static\/.+|\/sw-cache-complete)$/;

describe("install warms every free-play page and the assets it reaches (T-WEB-S1060)", () => {
  it("follows the index's free-play links, HTML refs, chunk strings in JS and CSS url(), and nothing else", async () => {
    const sw = worker();
    await sw.dispatch("install").settled();

    expect(sw.storedKeys().sort()).toEqual(
      [
        "/_next/static/chunks/a.js",
        "/_next/static/chunks/b.js",
        "/_next/static/chunks/lazy.css",
        "/_next/static/chunks/lazy.js",
        "/_next/static/chunks/s.css",
        "/_next/static/media/f.woff2",
        "/modo-livre",
        "/modo-livre/sudoku",
        "/modo-livre/termo",
        "/sw-cache-complete",
      ].sort(),
    );
    expect(sw.network.log).not.toContain("/");
    expect(sw.network.log).not.toContain("/termo");
    expect(sw.network.log).not.toContain("/arquivo");
    expect(sw.caches.stores.size).toBe(1);
  });

  it("does not wait on the warm in activate, and enables navigation preload there", async () => {
    const sw = worker();
    const activation = sw.dispatch("activate");
    await Promise.all(activation.waits);
    expect(sw.enablePreload).toHaveBeenCalledOnce();
    expect(sw.network.log).toEqual([]);
  });

  it("runs one warm at a time", async () => {
    const sw = worker();
    await Promise.all([
      sw.dispatch("install").settled(),
      sw.dispatch("install").settled(),
    ]);
    expect(sw.network.log.filter((path) => path === "/modo-livre")).toEqual([
      "/modo-livre",
    ]);
  });

  it("downloads nothing with Save-Data on", async () => {
    const sw = worker(site(), true);
    await sw.dispatch("install").settled();
    expect(sw.network.log).toEqual([]);
    expect(sw.storedKeys()).toEqual([]);
  });
});

describe("offline, free play answers from the cache and other pages fall back to it (T-WEB-S1061)", () => {
  it("serves a stored free-play page, query ignored", async () => {
    const sw = await installed();
    sw.network.online = false;
    const response = await sw.request("/modo-livre/termo?x=1").settled();
    expect(await response?.text()).toContain("s.css");
  });

  it("redirects a daily, the hub or an unstored free-play path to /modo-livre", async () => {
    const sw = await installed();
    sw.network.online = false;
    for (const path of ["/termo", "/", "/modo-livre/rainhas"]) {
      const response = await sw.request(path).settled();
      expect(response?.status).toBe(302);
      expect(response?.headers.get("Location")).toBe(`${ORIGIN}/modo-livre`);
    }
  });

  it("lets the network error stand when nothing is stored", async () => {
    const sw = worker();
    sw.network.online = false;
    await expect(sw.request("/termo").response()).rejects.toThrow("offline");
  });
});

describe("online, the worker passes through and stores nothing outside free play (T-WEB-S1062)", () => {
  it("answers from the network and never intercepts RSC, cross-origin or POST", async () => {
    const sw = await installed();
    const before = sw.storedKeys().sort();

    expect(await (await sw.request("/termo").settled())?.text()).toBe(
      "<p>daily</p>",
    );
    expect(await (await sw.request("/").settled())?.text()).toBe("<p>hub</p>");
    expect(
      sw.request("/modo-livre/termo?_rsc=abc", { mode: "cors" }).response(),
    ).toBeUndefined();
    expect(
      sw.request("https://api.miolos.test/day", { mode: "cors" }).response(),
    ).toBeUndefined();
    expect(
      sw.request("/modo-livre", { method: "POST" }).response(),
    ).toBeUndefined();
    await sw.request("/modo-livre/termo").settled();

    expect(sw.storedKeys().sort()).toEqual(before);
    expect(sw.storedKeys().every((key) => STORED_SHAPE.test(key))).toBe(true);
  });

  it("uses the navigation preload response when there is one", async () => {
    const sw = await installed();
    const response = await sw
      .request("/termo", { preload: Promise.resolve(served("preloaded")) })
      .settled();
    expect(await response?.text()).toBe("preloaded");
    expect(sw.network.log).toEqual([]);
  });
});

describe("a changed free-play page re-warms into a fresh cache (T-WEB-S1063)", () => {
  it("leaves the cache alone while the page is unchanged", async () => {
    const sw = await installed();
    await sw.request("/modo-livre/termo").settled();
    expect(sw.network.log).toEqual(["/modo-livre/termo"]);
  });

  it("swaps in a new cache on a deploy, copying assets it already holds", async () => {
    const sw = await installed();
    const [oldName] = sw.caches.stores.keys();
    await new Promise((resolve) => setTimeout(resolve, 2));
    sw.network.routes = site({
      "/modo-livre/termo": () =>
        served(`<script src="/_next/static/chunks/c.js"></script>`),
      "/_next/static/chunks/c.js": () => served("next()"),
    });

    await sw.request("/modo-livre/termo").settled();

    expect(sw.caches.stores.size).toBe(1);
    expect(sw.caches.stores.has(oldName ?? "")).toBe(false);
    expect(sw.storedKeys()).toContain("/_next/static/chunks/c.js");
    expect(sw.network.log).not.toContain("/_next/static/chunks/a.js");
  });
});

describe("a warm that fails never replaces a complete cache (T-WEB-S1064)", () => {
  it("drops its partial cache on a network error and keeps serving the old one", async () => {
    const sw = await installed();
    await new Promise((resolve) => setTimeout(resolve, 2));
    sw.network.routes = site({
      "/modo-livre/termo": () =>
        served(`<script src="/_next/static/chunks/d.js"></script>`),
      "/_next/static/chunks/d.js": () => {
        throw new TypeError("dropped");
      },
    });
    await sw.request("/modo-livre/termo").settled();

    expect(sw.caches.stores.size).toBe(1);
    sw.network.online = false;
    const response = await sw.request("/modo-livre/termo").settled();
    expect(await response?.text()).toContain("b.js");
  });

  it("never reads a newer cache that lacks the completion marker", async () => {
    const sw = await installed();
    const partial = await sw.caches.open(
      `miolos-livre-${String(Date.now() + 60_000)}`,
    );
    await partial.put(`${ORIGIN}/modo-livre/termo`, served("partial"));
    sw.network.online = false;
    const response = await sw.request("/modo-livre/termo").settled();
    expect(await response?.text()).toContain("b.js");
  });

  it("never stores a no-store or private response", async () => {
    const pageRefused = worker(
      site({
        "/modo-livre/sudoku": () =>
          served("<p>dynamic</p>", {
            headers: { "Cache-Control": "no-store" },
          }),
      }),
    );
    await pageRefused.dispatch("install").settled();
    expect(pageRefused.storedKeys()).toEqual([]);

    const assetSkipped = worker(
      site({
        "/_next/static/chunks/lazy.js": () =>
          served("lazy()", { headers: { "Cache-Control": "private" } }),
      }),
    );
    await assetSkipped.dispatch("install").settled();
    expect(assetSkipped.storedKeys()).not.toContain(
      "/_next/static/chunks/lazy.js",
    );
    expect(assetSkipped.storedKeys()).toContain("/sw-cache-complete");
  });
});

describe("build assets are cache first and never stored on a miss (T-WEB-S1065)", () => {
  it("serves a stored asset offline and passes a miss to the network", async () => {
    const sw = await installed();
    sw.network.online = false;
    const hit = await sw
      .request("/_next/static/chunks/a.js", { mode: "no-cors" })
      .settled();
    expect(await hit?.text()).toBe("console.log(1)");

    sw.network.online = true;
    sw.network.routes = site({
      "/_next/static/chunks/z.js": () => served("z"),
    });
    await sw
      .request("/_next/static/chunks/z.js", { mode: "no-cors" })
      .settled();
    expect(sw.storedKeys()).not.toContain("/_next/static/chunks/z.js");
  });
});

describe("the layout registers the worker in production only, on load (T-WEB-S1066)", () => {
  it("guards the inline script on NODE_ENV and registers /sw.js after load", () => {
    const layout = readFileSync(
      join(import.meta.dirname, "..", "app", "layout.tsx"),
      "utf8",
    );
    expect(layout).toMatch(
      /process\.env\.NODE_ENV === "production" &&[\s\S]*registerServiceWorkerScript/,
    );

    const register = vi.fn(() => Promise.resolve());
    const onLoad: (() => void)[] = [];
    const run = (navigator: object) => {
      runInContext(
        registerServiceWorkerScript,
        createContext({
          navigator,
          addEventListener: (type: string, listener: () => void) => {
            if (type === "load") onLoad.push(listener);
          },
        }),
      );
    };

    run({});
    expect(onLoad).toEqual([]);

    run({ serviceWorker: { register } });
    expect(register).not.toHaveBeenCalled();
    onLoad.forEach((listener) => listener());
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
