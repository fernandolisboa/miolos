"use client";

import nextDynamic from "next/dynamic";
import Link from "next/link";
import { Component, type ComponentType, type ReactNode } from "react";

import type { DayGameState } from "@miolos/core";

import { formatElapsed, messages, routes } from "../i18n";
import styles from "./conclusion-lazy.module.css";
import type { ConclusionResult } from "./conclusion-view";
import type { ConclusionCopy } from "./types";

/**
 * The conclusion tree behind a `next/dynamic` boundary, for the four PLAY
 * screen roots only (ADR-0054 decision 15). The conclusion only renders
 * after the grid closes, so it is a natural lazy boundary: the play
 * routes' first-load sets drop the whole tree.
 *
 * THREE RULES MAKE THIS SAFE:
 *
 * - `/<jogo>/concluido` pages and their per-game wrappers keep their
 *   STATIC imports of `conclusion-view` — that segment exists for a
 *   bookmark, a reload and `impeccable detect`, and its server render
 *   must keep carrying the real markup. Only the in-place swap on the
 *   play routes rides this module.
 * - every screen root calls its preload function below in a mount effect,
 *   so the chunk downloads in the background while the player is still
 *   solving and the win-moment swap resolves from the module cache — no
 *   flash where the celebration goes. This is a code chunk, never puzzle
 *   content, so ADR-0004 is untouched. The preloads live HERE, as named
 *   exports, so the warm is one observable seam a test can spy on
 *   (T-WEB-S289) — an inline `import()` inside a screen's effect was
 *   coverage-proof.
 * - the swap has a FAILURE STORY. Before this boundary the conclusion was
 *   in the first-load set and its presence was guaranteed; lazy, a chunk
 *   fetch can fail — connectivity lost inside the preload window, an
 *   aborted fetch, a cold cache on a flaky link — and `sw.js` deliberately
 *   caches nothing (ADR-0064 decision 5). So: while the chunk resolves,
 *   `ConclusionLoading` paints the conclusion-shaped skeleton (never a
 *   blank frame); on a failed load, `ConclusionChunkBoundary` retries the
 *   import ONCE and, if that also fails, renders
 *   `ConclusionChunkFallback` — the stamp word and the frozen time from
 *   props already in memory, no fetch, no rich module. The win is never a
 *   blank page and never Next's generic error screen, which is what keeps
 *   ADR-0028's "finishing offline works" true now that the tree is lazy.
 *
 * `ssr: false` changes nothing the play routes ever painted: a record is
 * localStorage and a claim is a client fetch, so no conclusion branch was
 * ever server-rendered on `/<jogo>`.
 */
type ConclusionModule = typeof import("./conclusion-view");
type ConclusionViewProps = Parameters<ConclusionModule["ConclusionView"]>[0];
type RemoteConclusionViewProps = Parameters<
  ConclusionModule["RemoteConclusionView"]
>[0];

/**
 * The pending frame: the conclusion's own skeleton shape (the
 * `data-conclusion-state="skeleton"` discipline of `conclusion-view.tsx` —
 * a beat of a card-shaped blank, never an empty document and never a
 * playable board). `next/dynamic`'s loading component receives no caller
 * props, so this frame is game-blind by construction; see the sheet for
 * why it is accent-free.
 *
 * IT RETHROWS THE LOADER'S ERROR, and that line is load-bearing: the app
 * build aliases `next/dynamic` to `app-dynamic`, where a failed chunk
 * rejects through `React.lazy` and reaches the boundary below on its own
 * (`error` here is always null) — but the un-aliased runtime tests execute
 * (`next/dist/shared/lib/dynamic`) swallows the failure into this
 * component's `error` prop instead. Throwing it restores the one
 * behaviour: a failed chunk always reaches `ConclusionChunkBoundary`.
 */
export function ConclusionLoading({
  error,
}: {
  readonly error?: Error | null;
}) {
  if (error !== undefined && error !== null) {
    throw error;
  }
  return (
    <main className={styles.page} data-conclusion-state="skeleton">
      <div aria-hidden className={styles.skeletonCard} />
    </main>
  );
}

type ChunkBoundaryState<T> =
  | { readonly phase: "lazy" }
  | { readonly phase: "retrying" }
  | { readonly phase: "recovered"; readonly value: T }
  | { readonly phase: "failed" };

/**
 * The error boundary around the lazy conclusion mount. On the first catch
 * it retries `retry()` — webpack
 * clears a failed chunk from its cache, so a second `import()` is a real
 * second network attempt — and renders the recovered module DIRECTLY:
 * `React.lazy` caches a rejection, so re-rendering the same lazy element
 * could never recover even after a successful retry. On a second failure
 * (the retry rejecting, or the recovered render throwing) it settles on
 * `fallback` and never loops.
 */
export class ConclusionChunkBoundary<T> extends Component<
  {
    readonly children: ReactNode;
    readonly retry: () => Promise<T>;
    readonly recovered: (value: T) => ReactNode;
    readonly fallback: ReactNode;
  },
  ChunkBoundaryState<T>
> {
  override state: ChunkBoundaryState<T> = { phase: "lazy" };
  private retried = false;

  static getDerivedStateFromError(): { phase: "retrying" } {
    return { phase: "retrying" };
  }

  override componentDidCatch(): void {
    if (this.retried) {
      this.setState({ phase: "failed" });
      return;
    }
    this.retried = true;
    this.props.retry().then(
      (value) => {
        this.setState({ phase: "recovered", value });
      },
      () => {
        this.setState({ phase: "failed" });
      },
    );
  }

  override render(): ReactNode {
    switch (this.state.phase) {
      case "lazy":
        return this.props.children;
      case "retrying":
        // The same pending frame the loading path paints: the retry is a
        // network round trip and the rule that nothing unproven paints
        // holds across it.
        return <ConclusionLoading />;
      case "recovered":
        return this.props.recovered(this.state.value);
      case "failed":
        return this.props.fallback;
    }
  }
}

/**
 * The honest minimum when the conclusion chunk is unreachable twice: the
 * stamp word and the frozen time from the values already in memory — the
 * caller's own props, so no fetch and no module load can fail under it —
 * plus the way home. Existing strings only. A caller with no honest stamp
 * (a Termo, whose conclusion never shows a time — ADR-0045 decision 4; a
 * remote claim that is not `completed`) passes none and gets the titled
 * card alone, which understates and never lies.
 */
export function ConclusionChunkFallback({
  copy,
  stamp,
}: {
  readonly copy: ConclusionCopy;
  readonly stamp?: ConclusionResult;
}) {
  return (
    <main className={styles.page} data-conclusion-state="degraded">
      <article className={styles.fallbackCard}>
        <p className={styles.kicker}>{copy.kicker}</p>
        {/* h1 first element child of its wrapper — the conclusion-view
            titleRow convention; the same impeccable rules anchor on
            `h1.previousElementSibling`. */}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{copy.title}</h1>
        </div>
        {stamp !== undefined && (
          <div
            className={styles.stamp}
            role="img"
            aria-label={messages.conclusion.stampAria(
              copy.title,
              formatElapsed(stamp.elapsedMs),
              stamp.hintsUsed,
            )}
          >
            <span aria-hidden className={styles.stampLabel}>
              {messages.conclusion.stampLabel}
            </span>
            <span aria-hidden className={styles.stampTime}>
              {formatElapsed(stamp.elapsedMs)}
            </span>
          </div>
        )}
        <Link className={styles.back} href={routes.home}>
          {messages.conclusion.back}
        </Link>
      </article>
    </main>
  );
}

/**
 * One lazy conclusion component with the whole failure story attached:
 * `next/dynamic` for the chunk split, `ConclusionLoading` for the pending
 * frame, and the retry-once boundary whose terminal fallback is composed
 * from the caller's own props. The per-game wrappers in
 * `termo-screen.tsx` / `nonogram-screen.tsx` build theirs through this
 * same helper, so all four screens degrade identically.
 */
export function resilientConclusion<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallbackOf: (props: P) => ReactNode,
): ComponentType<P> {
  const Lazy = nextDynamic(load, {
    ssr: false,
    loading: ConclusionLoading,
  });
  return function ResilientConclusion(props: P) {
    return (
      <ConclusionChunkBoundary
        retry={load}
        recovered={(Loaded) => <Loaded {...props} />}
        fallback={fallbackOf(props)}
      >
        <Lazy {...props} />
      </ConclusionChunkBoundary>
    );
  };
}

/**
 * The remote fallback's stamp: only a `completed` claim carrying BOTH
 * server-held values composes one — the per-line honesty of
 * `RemoteShippedStamp`, collapsed to its strongest line. A `played` claim
 * (a lost Termo) must never wear the stamp word, and a deploy-skew claim
 * with a bare time is left to the titled card rather than fabricating a
 * hint count. Exported for T-WEB-S288's understatement arms.
 */
export function remoteFallbackStamp(
  claim: DayGameState,
): ConclusionResult | undefined {
  return claim.status === "completed" &&
    claim.elapsedMs !== undefined &&
    claim.hintsUsed !== undefined
    ? { elapsedMs: claim.elapsedMs, hintsUsed: claim.hintsUsed }
    : undefined;
}

/* The two shipped fallback builders, named rather than inlined so
   T-WEB-S288 can pin their CONTENT (the stamp word and time from the
   caller's own props; the remote understatement) against exactly the
   values the components below hand to `resilientConclusion`. */

export function localConclusionFallback(props: ConclusionViewProps) {
  return <ConclusionChunkFallback copy={props.copy} stamp={props.result} />;
}

export function remoteConclusionFallback(props: RemoteConclusionViewProps) {
  return (
    <ConclusionChunkFallback
      copy={props.copy}
      stamp={remoteFallbackStamp(props.claim)}
    />
  );
}

export const ConclusionView = resilientConclusion<ConclusionViewProps>(
  async () => (await import("./conclusion-view")).ConclusionView,
  localConclusionFallback,
);

export const RemoteConclusionView =
  resilientConclusion<RemoteConclusionViewProps>(
    async () => (await import("./conclusion-view")).RemoteConclusionView,
    remoteConclusionFallback,
  );

/* The mount-time warms. `.catch` swallows deliberately: the preload is
   opportunistic — a failure here surfaces as nothing today and, if the
   player finishes, as the boundary's retry-then-fallback story above —
   and an unswallowed rejection from a background warm is exactly the
   unhandled-rejection noise a flaky link would print once per screen. */

export function preloadConclusionView(): void {
  void import("./conclusion-view").catch(() => undefined);
}

/** Warms `termo-conclusion` AND, through its static import, the shared
 *  conclusion tree — one preload covers the local and remote views. */
export function preloadTermoConclusion(): void {
  void import("../termo/termo-conclusion").catch(() => undefined);
}

/** The Nonogram twin of `preloadTermoConclusion`. */
export function preloadNonogramConclusion(): void {
  void import("../nonogram/nonogram-conclusion").catch(() => undefined);
}
