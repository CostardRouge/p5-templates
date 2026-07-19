/**
 * Fine-grained asset-loading progress reporter.
 *
 * Every asset loader (images, fonts, audio, video, sketch modules) opens a
 * *loading step* here when it kicks off work and settles it when the asset
 * is usable (or failed). Subscribers — the engine's `loading` event, the
 * sketch-page placeholder, the load profiler — receive a snapshot on every
 * transition, so "what is still loading" is observable instead of guessed.
 *
 * Steps are also registered with `pendingMedia`, so deterministic capture
 * automatically waits for in-flight asset loads between seek and readFrame.
 *
 * The registry is a per-sketch singleton: `resetLoadingProgress()` is called
 * by the engine on every `init()` so a new sketch starts a fresh report.
 */

import {
  trackPendingMedia
} from "./pendingMedia";

export type LoadingAssetKind =
  | "image"
  | "font"
  | "audio"
  | "video"
  | "module";

export type LoadingStepStatus = "pending" | "loaded" | "failed";

export type LoadingStep = {
  /** Monotonic id, unique within one sketch run. */
  id: number;
  kind: LoadingAssetKind;
  /** Human-readable label (file name, font key, module path…). */
  label: string;
  status: LoadingStepStatus;
  /** `performance.now()` when the step opened. */
  startedAt: number;
  /** `performance.now()` when the step settled (undefined while pending). */
  settledAt?: number;
};

export type LoadingProgressSnapshot = {
  /** All steps of the current sketch run, in open order. */
  steps: LoadingStep[];
  pending: number;
  loaded: number;
  failed: number;
  total: number;
  /** `true` once every opened step has settled. */
  settled: boolean;
};

type Subscriber = ( snapshot: LoadingProgressSnapshot ) => void;

let steps: LoadingStep[] = [];
let nextId = 1;

const subscribers = new Set<Subscriber>();

// Resolvers of still-pending steps, so a reset can release the promises
// registered with pendingMedia — otherwise steps orphaned by a sketch
// switch would gate deterministic capture forever.
const pendingResolvers = new Set<() => void>();

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function getLoadingProgressSnapshot(): LoadingProgressSnapshot {
  const pending = steps.filter( ( s ) => s.status === "pending" ).length;
  const failed = steps.filter( ( s ) => s.status === "failed" ).length;

  return {
    steps: steps.map( ( s ) => ( {
      ...s
    } ) ),
    pending,
    failed,
    loaded: steps.length - pending - failed,
    total: steps.length,
    settled: pending === 0
  };
}

function notify(): void {
  if ( subscribers.size === 0 ) {
    return;
  }

  const snapshot = getLoadingProgressSnapshot();

  subscribers.forEach( ( cb ) => {
    try {
      cb( snapshot );
    } catch {
      // Reporting must never break a loader.
    }
  } );
}

/**
 * Subscribe to progress changes. The callback fires immediately with the
 * current snapshot, then on every step open/settle. Returns an unsubscribe.
 */
export function subscribeLoadingProgress( cb: Subscriber ): () => void {
  subscribers.add( cb );
  cb( getLoadingProgressSnapshot() );

  return () => {
    subscribers.delete( cb );
  };
}

/**
 * Drop all recorded steps. Called by the engine on `init()` so each sketch
 * run reports from a clean slate. Subscribers survive a reset.
 */
export function resetLoadingProgress(): void {
  steps = [];
  pendingResolvers.forEach( ( resolve ) => resolve() );
  pendingResolvers.clear();
  notify();
}

export type LoadingStepHandle = {
  /** Mark the step as successfully loaded. Idempotent. */
  loaded: () => void;
  /** Mark the step as failed. Idempotent. */
  failed: ( error?: unknown ) => void;
  /** Resolves when the step settles (never rejects). */
  promise: Promise<void>;
};

/**
 * Open a loading step for a callback-style loader (p5 `loadImage`,
 * `loadFont`, …). The returned handle settles the step; its `promise` is
 * also registered with `pendingMedia` so capture waits on it.
 */
export function beginLoadingStep(
  kind: LoadingAssetKind,
  label: string
): LoadingStepHandle {
  const step: LoadingStep = {
    id: nextId++,
    kind,
    label,
    status: "pending",
    startedAt: now()
  };

  steps.push( step );

  let resolvePromise: () => void = () => {};

  const promise = new Promise<void>( ( resolve ) => {
    resolvePromise = resolve;
  } );

  const settle = ( status: LoadingStepStatus ) => {
    if ( step.status !== "pending" ) {
      return;
    }

    step.status = status;
    step.settledAt = now();
    pendingResolvers.delete( resolvePromise );
    resolvePromise();
    notify();
  };

  pendingResolvers.add( resolvePromise );
  trackPendingMedia( promise );
  notify();

  return {
    loaded: () => settle( "loaded" ),
    failed: () => settle( "failed" ),
    promise
  };
}

/**
 * Report a promise-style asset load as a step. Returns the same promise so
 * call sites can stay one-liners:
 *
 *   const buffer = await reportAssetLoading( "audio", name, decode( url ) );
 */
export function reportAssetLoading<T>(
  kind: LoadingAssetKind,
  label: string,
  promise: Promise<T>
): Promise<T> {
  const handle = beginLoadingStep(
    kind,
    label
  );

  promise.then(
    () => handle.loaded(),
    ( error ) => handle.failed( error )
  );

  return promise;
}
