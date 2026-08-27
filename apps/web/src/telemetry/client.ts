import type { Game } from "@miolos/core";

let sessionReady = false;

let buffered: { readonly game: Game; readonly date: string }[] = [];

const fired = new Set<string>();

export function markSessionReady(): void {
  sessionReady = true;
  const pending = buffered;
  buffered = [];
  for (const event of pending) {
    send(event.game, event.date);
  }
}

export function postPuzzleStarted(game: Game, date: string): void {
  const key = `${game}:${date}`;
  if (fired.has(key)) {
    return;
  }
  fired.add(key);
  if (!sessionReady) {
    buffered.push({ game, date });
    return;
  }
  send(game, date);
}

let warnedMissingApiUrl = false;

function send(game: Game, date: string): void {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    if (!warnedMissingApiUrl) {
      warnedMissingApiUrl = true;
      console.error(
        "NEXT_PUBLIC_API_URL is unset: puzzle_started not reported, telemetry stays blind",
      );
    }
    return;
  }
  try {
    void fetch(`${apiUrl}/telemetry`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },

      body: JSON.stringify({
        event: "puzzle_started",
        properties: { game, date },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A stubbed or replaced `fetch` must not take the mount effect with it.
  }
}
