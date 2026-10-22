import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { jsonResponse } from "./fetch-stub";

const API_URL = "https://api.example.test";
const SETTINGS_KEY = "miolos-settings";
const SYNC_KEY = "miolos-settings-sync";

vi.mock("../src/session/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/session/bootstrap")>()),
  ensureSession: () => Promise.resolve(),
}));

interface Account {
  settings: unknown;
  writeStatus: number | "offline";
}

function stubAccount(
  initial: unknown,
  writeStatus: Account["writeStatus"] = 200,
) {
  const account: Account = { settings: initial, writeStatus };
  const writes: unknown[] = [];
  let release: (() => void) | undefined;
  let held: Account | undefined;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/account/game-settings")) {
      if (account.writeStatus === "offline") {
        return Promise.reject(new TypeError("offline"));
      }
      const { settings } = JSON.parse(init?.body as string) as {
        settings: unknown;
      };
      writes.push(settings);
      if (account.writeStatus === 200) {
        account.settings = settings;
        return Promise.resolve(jsonResponse(200, { saved: true }));
      }
      return Promise.resolve(
        jsonResponse(account.writeStatus, { error: "nope" }),
      );
    }
    if (url.endsWith("/account/game-settings/state")) {
      const answer = () => jsonResponse(200, { settings: account.settings });
      return account === held
        ? new Promise<Response>((resolve) => {
            release = () => {
              resolve(answer());
            };
          })
        : Promise.resolve(answer());
    }
    return Promise.resolve(jsonResponse(404, { error: "not-found" }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    account,
    writes,
    fetchMock,
    holdReads: () => {
      held = account;
    },
    releaseRead: () => release?.(),
  };
}

async function load() {
  vi.resetModules();
  const settings = await import("../src/settings/settings");
  const state = await import("../src/settings/sync-state");
  const sync = await import("../src/settings/account-sync");
  return { ...settings, ...state, ...sync };
}

function storedSync(): unknown {
  const raw = window.localStorage.getItem(SYNC_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

describe("the per-device sync flag (T-WEB-S1023)", () => {
  it("is off by default, survives as {on, pending}, leaves no key when both are off, and a malformed key reads as off", async () => {
    const { readSyncState, writeSyncState } = await load();
    expect(readSyncState()).toEqual({ on: false, pending: false });
    writeSyncState({ on: true, pending: true });
    expect(storedSync()).toEqual({ on: true, pending: true });
    expect(readSyncState()).toEqual({ on: true, pending: true });
    writeSyncState({ on: false, pending: false });
    expect(storedSync()).toBeNull();
    window.localStorage.setItem(SYNC_KEY, "{not json");
    expect(readSyncState()).toEqual({ on: false, pending: false });
    window.localStorage.setItem(SYNC_KEY, '{"on":"yes"}');
    expect(readSyncState()).toEqual({ on: false, pending: false });
  });
});

describe("turning sync on adopts the account's copy and never echoes it back (T-WEB-S1024)", () => {
  it("writes the account copy through the web schema, so an unknown key drops and a missing one takes its default, and pushes nothing", async () => {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ showClock: true, endAnimation: false }),
    );
    const { writes } = stubAccount({
      showClock: false,
      retired: true,
      games: { sudoku: { lockDigit: true } },
    });
    const { turnSyncOn, readSettings } = await load();

    await turnSyncOn();

    const settings = readSettings();
    expect(settings.showClock).toBe(false);
    expect(settings.endAnimation).toBe(true);
    expect(settings.games.sudoku.lockDigit).toBe(true);
    expect(settings.games.sudoku.highlightSelection).toBe(true);
    expect("retired" in settings).toBe(false);
    expect(writes).toEqual([]);
    expect(storedSync()).toEqual({ on: true, pending: false });
  });
});

describe("an empty account is seeded only by a device someone customised (T-WEB-S1025)", () => {
  it("pushes the stored device copy, and leaves the account empty when the device is still on defaults", async () => {
    const first = stubAccount(null);
    const fresh = await load();
    await fresh.turnSyncOn();
    expect(first.writes).toEqual([]);
    fresh.turnSyncOff();

    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ showClock: false }),
    );
    const second = stubAccount(null);
    const customised = await load();
    await customised.turnSyncOn();
    expect(second.writes).toHaveLength(1);
    expect(second.writes[0]).toEqual(customised.readSettings());
    expect(storedSync()).toEqual({ on: true, pending: false });
  });
});

describe("a change the account never received wins on the next start (T-WEB-S1026)", () => {
  it("with pending set, the start pushes the device copy instead of reading", async () => {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ showClock: false }),
    );
    window.localStorage.setItem(
      SYNC_KEY,
      JSON.stringify({ on: true, pending: true }),
    );
    const { writes, fetchMock } = stubAccount({ showClock: true });
    const { startSettingsSync, readSettings } = await load();

    await startSettingsSync();

    expect(readSettings().showClock).toBe(false);
    expect(writes).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith("/state")),
    ).toHaveLength(0);
    expect(storedSync()).toEqual({ on: true, pending: false });
  });

  it("turning sync on clears a stale pending flag, so the account copy still wins", async () => {
    window.localStorage.setItem(
      SYNC_KEY,
      JSON.stringify({ on: false, pending: true }),
    );
    const { writes } = stubAccount({ showClock: false });
    const { turnSyncOn, readSettings } = await load();
    await turnSyncOn();
    expect(readSettings().showClock).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe("a change made while the account is read wins over the read (T-WEB-S1027)", () => {
  it("keeps the local change and pushes it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const stub = stubAccount({ showClock: true });
    stub.holdReads();
    const { turnSyncOn, readSettings, writeSettings } = await load();

    const started = turnSyncOn();
    writeSettings({ ...readSettings(), showClock: false });
    expect(storedSync()).toEqual({ on: true, pending: true });
    stub.releaseRead();
    await started;
    expect(readSettings().showClock).toBe(false);

    await vi.advanceTimersByTimeAsync(800);
    expect(stub.writes).toHaveLength(1);
    expect(stub.account.settings).toEqual(readSettings());
    expect(storedSync()).toEqual({ on: true, pending: false });
  });
});

describe("a local change is pending at once and pushed 800 ms after the last one (T-WEB-S1028)", () => {
  async function changeOnce(writeStatus: Account["writeStatus"]) {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const stub = stubAccount({ showClock: true }, writeStatus);
    const sync = await load();
    await sync.turnSyncOn();
    sync.writeSettings({ ...sync.readSettings(), showClock: false });
    sync.writeSettings({ ...sync.readSettings(), endAnimation: false });
    expect(storedSync()).toEqual({ on: true, pending: true });
    await vi.advanceTimersByTimeAsync(799);
    expect(stub.writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    return stub;
  }

  it("a 2xx clears pending and sends the latest copy once", async () => {
    const stub = await changeOnce(200);
    expect(stub.writes).toHaveLength(1);
    expect(stub.writes[0]).toMatchObject({
      showClock: false,
      endAnimation: false,
    });
    expect(storedSync()).toEqual({ on: true, pending: false });
  });

  it("a network error or a 5xx keeps pending for the next start", async () => {
    await changeOnce("offline");
    expect(storedSync()).toEqual({ on: true, pending: true });
    await changeOnce(503);
    expect(storedSync()).toEqual({ on: true, pending: true });
  });

  it("a 4xx clears pending, so a refused copy is not retried forever", async () => {
    await changeOnce(400);
    expect(storedSync()).toEqual({ on: true, pending: false });
  });
});

describe("turning sync off stops it at once (T-WEB-S1029)", () => {
  it("a change after off sends nothing, a push already scheduled drops itself, and a second start is the same run", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const stub = stubAccount({ showClock: true });
    const sync = await load();
    const first = sync.turnSyncOn();
    expect(sync.startSettingsSync()).toBe(first);
    await first;

    sync.writeSettings({ ...sync.readSettings(), showClock: false });
    sync.writeSyncState({ on: false, pending: false });
    await vi.advanceTimersByTimeAsync(800);
    expect(stub.writes).toEqual([]);

    sync.turnSyncOff();
    sync.writeSettings({ ...sync.readSettings(), endAnimation: false });
    await vi.advanceTimersByTimeAsync(800);
    expect(stub.writes).toEqual([]);
    expect(storedSync()).toBeNull();
  });
});

describe("the root bootstrap starts sync only on a device that turned it on (T-WEB-S1030)", () => {
  it("off: no settings call at all; on: the account copy is read and applied", async () => {
    const off = stubAccount({ showClock: false });
    vi.resetModules();
    const { SessionBootstrap } =
      await import("../src/components/session-bootstrap");
    const first = render(<SessionBootstrap />);
    await act(async () => {});
    expect(
      off.fetchMock.mock.calls.filter(([url]) => url.includes("game-settings")),
    ).toEqual([]);
    first.unmount();

    window.localStorage.setItem(
      SYNC_KEY,
      JSON.stringify({ on: true, pending: false }),
    );
    const on = stubAccount({ showClock: false });
    vi.resetModules();
    const fresh = await import("../src/components/session-bootstrap");
    const { readSettings } = await import("../src/settings/settings");
    render(<fresh.SessionBootstrap />);
    await vi.waitFor(() => {
      expect(readSettings().showClock).toBe(false);
    });
    expect(
      on.fetchMock.mock.calls.filter(([url]) => url.endsWith("/state")),
    ).toHaveLength(1);
  });
});

describe("the Sincronizar com a conta switch in Ajustes (T-WEB-S1031)", () => {
  it("starts off, turns sync on and off, and the Jogos card shows it above the game switches", async () => {
    stubAccount(null);
    vi.resetModules();
    const { GamesSection } = await import("../app/ajustes/games-section");
    render(<GamesSection />);
    const copy = messages.settings.games;
    const toggle = screen.getByRole("switch", { name: copy.sync.label });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toBe(toggle);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(storedSync()).toEqual({ on: true, pending: false });
    await act(async () => {});

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(storedSync()).toBeNull();
  });
});
