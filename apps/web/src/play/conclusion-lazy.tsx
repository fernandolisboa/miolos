"use client";

import nextDynamic from "next/dynamic";
import Link from "next/link";
import { Component, type ComponentType, type ReactNode } from "react";

import type { DayGameState } from "@miolos/core";

import { formatElapsed, messages, routes } from "../i18n";
import styles from "./conclusion-lazy.module.css";
import type { ConclusionResult } from "./conclusion-view";
import type { ConclusionCopy } from "./types";

type ConclusionModule = typeof import("./conclusion-view");
type ConclusionViewProps = Parameters<ConclusionModule["ConclusionView"]>[0];
type RemoteConclusionViewProps = Parameters<
  ConclusionModule["RemoteConclusionView"]
>[0];

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
        return <ConclusionLoading />;
      case "recovered":
        return this.props.recovered(this.state.value);
      case "failed":
        return this.props.fallback;
    }
  }
}

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

export function remoteFallbackStamp(
  claim: DayGameState,
): ConclusionResult | undefined {
  return claim.status === "completed" &&
    claim.elapsedMs !== undefined &&
    claim.hintsUsed !== undefined
    ? { elapsedMs: claim.elapsedMs, hintsUsed: claim.hintsUsed }
    : undefined;
}

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

export function preloadConclusionView(): void {
  void import("./conclusion-view").catch(() => undefined);
}

export function preloadTermoConclusion(): void {
  void import("../termo/termo-conclusion").catch(() => undefined);
}

export function preloadNonogramConclusion(): void {
  void import("../nonogram/nonogram-conclusion").catch(() => undefined);
}
