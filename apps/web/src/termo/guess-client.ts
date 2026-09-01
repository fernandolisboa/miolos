import {
  apiErrorResponseSchema,
  termoGuessRequestSchema,
  termoGuessResponseSchema,
} from "@miolos/core";
import type { TermoBoardStatus, TileStates } from "@miolos/games/termo";

import { apiBaseUrl, postJson } from "../api/client";
import {
  confirmSession,
  ensureSession,
  remintSession,
} from "../session/bootstrap";

export type HeldReason = "offline" | "server";

export type GuessOutcome =
  | {
      readonly kind: "judged";
      readonly tiles: readonly TileStates[];
      readonly status: TermoBoardStatus;
      readonly answer?: string;
    }
  | { readonly kind: "held"; readonly reason: HeldReason }
  | { readonly kind: "rejected"; readonly reason: "not-in-list" | "refused" }
  | { readonly kind: "gone" };

const REFUSING_STATUSES = new Set([400, 403, 415]);

const HELD_OFFLINE: GuessOutcome = { kind: "held", reason: "offline" };
const HELD_SERVER: GuessOutcome = { kind: "held", reason: "server" };
const REFUSED: GuessOutcome = { kind: "rejected", reason: "refused" };

function heldByStatus(): GuessOutcome {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? HELD_OFFLINE
    : HELD_SERVER;
}

export async function postGuesses(
  date: string,
  guesses: readonly string[],
): Promise<GuessOutcome> {
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

  const apiUrl = apiBaseUrl(
    "the termo guess cannot be judged, the turn is held",
  );
  if (!apiUrl) {
    return HELD_SERVER;
  }

  const body = JSON.stringify(request.data);

  await ensureSession();

  let response = await postJson(`${apiUrl}/termo/guess`, body);
  if (response?.status === 401) {
    if (await remintSession()) {
      response = await postJson(`${apiUrl}/termo/guess`, body);
      if (response?.ok === true) {
        confirmSession();
      }
    }
  }

  if (response === undefined) {
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

  return heldByStatus();
}

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

    return HELD_SERVER;
  }
}

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
