/**
 * POST a Termo guess list and return the judgement, or a typed failure
 * (#27, plan 022 §11.4/§14.5, ADR-0038, ADR-0039).
 *
 * NOT `sync.ts`, and the five reasons are grounded rather than stylistic:
 *
 * 1. That module is a COMPLETIONS queue by construction — it posts to
 *    `/completions` and its queue is `listPendingRecords()`, i.e. "a finished
 *    result the server has not acknowledged".
 * 2. Its settlement is wrong for a turn: `settle(record, "rejected")` clears
 *    `pendingSync` PERMANENTLY, and a failed guess must stay re-postable.
 * 3. Its ladder is deliberately un-urgent ([2s, 5s, 15s, 60s]) and its
 *    handler bails outright in a hidden tab. Correct for a background
 *    completion; wrong for a turn the player is staring at.
 * 4. Its module-level singletons exist to keep ONE game-blind queue coherent,
 *    so pushing a foreground turn through them would let a background flush
 *    reset a live retry, and vice versa (ADR-0039 decision 4).
 * 5. ADR-0029 decision 3 scopes `sync.ts`'s genericity to the queue machinery
 *    FOR COMPLETIONS, with `buildBody` as the one per-game dispatch. That
 *    obligation is untouched — #27 still adds `case "termo"` there.
 *
 * It shares exactly two things with `sync.ts`: `ensureSession()`, which is
 * already a module-level shared promise and safe for a second caller, and the
 * "re-mint once per page load on a 401" rule — WHICH IS NOT DUPLICATED HERE.
 * That rule used to live as a local boolean in each module, and the earlier
 * version of this paragraph cleared the duplication on the grounds that a
 * guess touches no localStorage queue. That was right about the queue and
 * silent about the thing that actually breaks: `ensureSession` holds ONE
 * module-level promise, a forced re-mint replaces it, and `POST /session`
 * mints a brand-new user for any cookieless request. Two booleans that cannot
 * see each other therefore put two cookieless mints in flight at once and let
 * a completion be written for the identity that lost the `Set-Cookie` race
 * (finding B-1). The allowance now lives in `session/bootstrap.ts` beside the
 * promise it guards; this module keeps only its own decision to ASK.
 *
 * A QUEUED GUESS WOULD BE INCOHERENT: by the time a queue drained, the board
 * may have moved on, and there is no "later" for a turn the player is
 * watching. So every failure resolves to one of four outcomes, and the screen
 * decides what the player sees.
 */
import {
  apiErrorResponseSchema,
  termoGuessRequestSchema,
  termoGuessResponseSchema,
} from "@miolos/core";
import type { TermoBoardStatus, TileStates } from "@miolos/games/termo";

import {
  confirmSession,
  ensureSession,
  remintSession,
} from "../session/bootstrap";

/**
 * WHY THE TURN IS HELD, and it is on the type because the screen makes a
 * FACTUAL CLAIM ABOUT THE PLAYER'S NETWORK out of it (finding B-7). One
 * string — "Sem conexão — a tentativa vai assim que a conexão voltar." — used
 * to answer 500, 502, 429 and a 401 after the one re-mint as well as a real
 * network failure, which is false in three of those four cases and points the
 * player at a fix that cannot help.
 *
 * `offline` is claimed ONLY when the client can see it: the fetch itself
 * rejected, or `navigator.onLine` is false. Everything else is `server` —
 * ours, not theirs.
 */
export type HeldReason = "offline" | "server";

export type GuessOutcome =
  /** The server judged the board. `answer` is present iff it closed. */
  | {
      readonly kind: "judged";
      readonly tiles: readonly TileStates[];
      readonly status: TermoBoardStatus;
      readonly answer?: string;
    }
  /** Offline, 5xx, 429, or a 401 after the one re-mint — the turn SURVIVES. */
  | { readonly kind: "held"; readonly reason: HeldReason }
  /**
   * 400 / 403 / 415 / 422 — cleared, and the turn is NOT consumed. The REASON
   * is part of the type because the screen has to tell "that word is not in
   * the list" from "we could not process that", and the server is the last
   * boundary that still holds the distinction (the 422 body's error code).
   * `invalid-guess` is reachable in normal operation: apps/web and apps/api
   * deploy independently and ADR-0015 expects the validation list to be
   * regenerated, so a word the client's copy accepts and the server's does
   * not is a PLAYER outcome rather than a fault.
   */
  | { readonly kind: "rejected"; readonly reason: "not-in-list" | "refused" }
  /** 404 — the day is unavailable. */
  | { readonly kind: "gone" };

/**
 * Statuses on which the server has answered about the WORD or the request,
 * and no retry can change its mind. 404 is handled separately (it is the
 * day, not the turn) and 422 splits on its error code.
 */
const REFUSING_STATUSES = new Set([400, 403, 415]);

const HELD_OFFLINE: GuessOutcome = { kind: "held", reason: "offline" };
const HELD_SERVER: GuessOutcome = { kind: "held", reason: "server" };
const REFUSED: GuessOutcome = { kind: "rejected", reason: "refused" };

/**
 * A hold the client can only attribute to the server UNLESS the browser is
 * telling it otherwise. `navigator.onLine === false` is trusted in exactly
 * one direction — false is reliable, true is not — which is why every other
 * hold reads as `server` rather than guessing.
 */
function heldByStatus(): GuessOutcome {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? HELD_OFFLINE
    : HELD_SERVER;
}

export async function postGuesses(
  date: string,
  guesses: readonly string[],
): Promise<GuessOutcome> {
  // Parsed before it leaves, never trusted (CLAUDE.md's boundary rule runs in
  // both directions). A body the contract refuses cannot be fixed by
  // retrying, so it is `refused` rather than held — and nothing is posted.
  const request = termoGuessRequestSchema.safeParse({
    game: "termo",
    date,
    guesses,
  });
  if (!request.success) {
    console.error(
      `a termo guess list for ${date} does not satisfy the request contract; it will not be posted`,
    );
    return REFUSED;
  }

  // Loud, not silent: a relative "undefined/termo/guess" fetch would 404
  // against the web app itself and read to the player as a dead day.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: the termo guess cannot be judged, the turn is held",
    );
    // A misconfigured build is OURS however good the player's connection is.
    return HELD_SERVER;
  }

  const body = JSON.stringify(request.data);

  // Before the FIRST post, never after: on a cold first visit a fast opening
  // guess reliably beats the in-flight mint and would take the 401 branch.
  await ensureSession();

  let response = await post(apiUrl, body);
  if (response?.status === 401) {
    // The allowance is `session/bootstrap.ts`'s, not this module's — see the
    // header. It resolves `false` when it is spent, and nothing is re-posted.
    if (await remintSession()) {
      response = await post(apiUrl, body);
      if (response !== undefined && response.status !== 401) {
        // The fresh identity works, so a cookie that expires LATER in this
        // page load can still be re-minted — without this the first spent
        // allowance leaves the board held until a reload (finding B-2).
        confirmSession();
      }
    }
  }

  if (response === undefined) {
    // Network failure. The turn is the player's and it stays theirs, and this
    // is the ONE branch that can honestly say "sem conexão".
    return HELD_OFFLINE;
  }

  if (response.ok) {
    return await judgement(response);
  }

  if (response.status === 404) {
    return { kind: "gone" };
  }

  if (response.status === 422) {
    return { kind: "rejected", reason: await refusalReason(response) };
  }

  if (REFUSING_STATUSES.has(response.status)) {
    return REFUSED;
  }

  // 401 after the one re-mint, 429, every 5xx, and anything unforeseen.
  // A rate limit is not a verdict, and spending one of six turns on one would
  // be the worst possible reading of it.
  return heldByStatus();
}

/** `undefined` on a network failure — the one case that is not a status. */
async function post(
  apiUrl: string,
  body: string,
): Promise<Response | undefined> {
  try {
    return await fetch(`${apiUrl}/termo/guess`, {
      method: "POST",
      // The cookie IS the identity.
      credentials: "include",
      // Required by the route: a JSON content type forces a CORS preflight,
      // which is what makes the WEB_ORIGIN grant load-bearing rather than the
      // origin guard alone.
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return undefined;
  }
}

/**
 * A 200, parsed against the contract and never cast. A body the contract does
 * not recognise is a SERVER BUG, not a player problem, so the turn is HELD —
 * never `judged` (which would render tiles nobody computed) and never
 * `rejected` (which would blame the player for our defect). `sync.ts`'s own
 * `completionResponseSchema.parse` in a try/catch is the shipped precedent.
 */
async function judgement(response: Response): Promise<GuessOutcome> {
  try {
    const parsed = termoGuessResponseSchema.parse(await response.json());
    return {
      kind: "judged",
      tiles: parsed.tiles,
      status: parsed.status,
      answer: parsed.answer,
    };
  } catch {
    console.error(
      "a termo guess came back 200 with a body the contract does not recognize; the turn is held",
    );
    // A body we cannot read is OUR defect, not the player's connection.
    return HELD_SERVER;
  }
}

/**
 * Which 422 this is, and the two codes mean OPPOSITE things to the player.
 *
 * `invalid-guess` ⟺ the NEWEST guess is not in the server's validation
 * dictionary. A legitimate player outcome — `apps/web` and `apps/api` deploy
 * independently and ADR-0015 expects the list to be regenerated — so it routes
 * to the same sentence the local `isValidGuess` rejection renders.
 *
 * `board-closed` ⟺ the posted list continues past a winning row. That is a
 * client bug or tampering and NEVER a player outcome, so it must not read as
 * "não está na lista" — a desynced board would otherwise be told a correct
 * word is not in the dictionary (findings A-3/B-8). It is `refused`, which
 * renders `copy.failed`. The route used to answer this condition with
 * `invalid-guess` too; the distinct code is the server half of the same fix.
 *
 * Every other code — and an unreadable body — is a system outcome and reads as
 * one. The `switch` is exhaustive over what the client acts on rather than a
 * ternary, so a third code added later has one obvious place to land.
 */
async function refusalReason(
  response: Response,
): Promise<"not-in-list" | "refused"> {
  try {
    const parsed = apiErrorResponseSchema.parse(await response.json());
    switch (parsed.error) {
      case "invalid-guess":
        return "not-in-list";
      case "board-closed":
        return "refused";
      default:
        return "refused";
    }
  } catch {
    return "refused";
  }
}
