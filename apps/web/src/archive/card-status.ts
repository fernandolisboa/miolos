import type { PlayRecord } from "../play/play-record";

/**
 * What THIS DEVICE knows about one archived (game, date) — the projection
 * behind `/arquivo/<data>`'s per-game done chip (#96, ADR-0056).
 *
 * A pure function over one record: no React, no hook, no cache. The card that
 * renders it subscribes through `use-record-snapshot.ts`, which is where the
 * store, the caching and the referential stability live.
 *
 * MONOTONE-SAFE, the same way the hub's reader is (ADR-0031 decision 2). A
 * concluded record proves this device finished that game on that date;
 * ABSENCE PROVES NOTHING and reads `pending`. That is the cold-profile
 * default, what a second device sees, what a browser with no usable store
 * sees, and what a device sees once `prunePlayRecords` has dropped a record
 * beyond the retained window (ADR-0053 decision 14). None of those cases gets
 * a caveat line in the UI: ADR-0031 decision 2's Rejected list refuses
 * "treating the absence of a record as 'not done' authoritatively", and a
 * hedge sentence is the same move wearing an apology. ADR-0053 decision 10
 * layer 3 already owns the gap.
 *
 * THE SYNC FIELDS ARE DELIBERATELY NOT READ. `concluded: true` means this
 * device finished the board, which is true whether or not the server kept a
 * row, so a `pendingSync` or `syncOutcome: "rejected"` record still reads
 * `completed`. Branching on either would make this projection an authority on
 * SERVER state, which ADR-0031 decision 6 forbids and which ADR-0053
 * decision 10 gives the reason for. The archive's own result panel owns that
 * truth and states it in a full sentence one tap away.
 *
 * RE-DERIVED, NOT IMPORTED, and the wall is the reason: `T-WEB-S183` and
 * ADR-0053 decision 9 keep `apps/web/src/play/day-state.ts` out of the
 * archive's module graph, and that module's projection is where the identical
 * Termo branch lives. It also carries `elapsedMs`, `completedCount` and
 * `nextPendingDaily`, none of which any archive surface publishes (the chip
 * carries no duration and no result figure at all — ADR-0056 decision 2's
 * neighbourhood, plan 043 D4). `T-WEB-S215` is the standing instrument that
 * keeps the two answers identical.
 *
 * ONE MORE THING THE HUB'S UNION SAYS ABOUT THIS ONE: it was built to exclude
 * the state a local reader cannot see, a LATE completion. On `/arquivo/<data>`
 * every completion this can return IS a late one. The chip nonetheless wears
 * the hub's on-time word, deliberately and reversibly — ADR-0056 decision 2.
 */
export type ArchiveCardStatus = "pending" | "completed" | "played";

export function archiveCardStatus(
  record: PlayRecord | undefined,
): ArchiveCardStatus {
  if (record === undefined || !record.concluded) {
    return "pending";
  }
  // Only Termo can end here (CONTEXT.md:13, ADR-0008 rule 3): a lost board is
  // PLAYED and never COMPLETED. Collapsing the two would stamp a false done
  // on a loss, the one direction ADR-0031 decision 2 forbids by name.
  if (record.game === "termo" && record.outcome === "lost") {
    return "played";
  }
  return "completed";
}
