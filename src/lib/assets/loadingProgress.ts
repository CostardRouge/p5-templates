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
 * A step only opens when its own load *starts*, so counting steps alone makes
 * the total climb as loading proceeds (modules, then images, then fonts). To
 * report a stable figure the engine declares an expected total up front with
 * `planLoadingSteps`, and the snapshot's `progress` is clamped monotonic — the
 * two together are what stop the readout jumping backwards.
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

/** How many steps of each kind a caller expects to open. */
export type LoadingPlan = Partial<Record<LoadingAssetKind, number>>;

export type LoadingProgressSnapshot = {
  /** All steps of the current sketch run, in open order. */
  steps: LoadingStep[];
  pending: number;
  loaded: number;
  failed: number;
  /** Total declared through `planLoadingSteps` (0 when nothing was declared). */
  planned: number;
  /** `max( steps opened, planned )` — never shrinks below what actually opened. */
  total: number;
  /**
   * 0..1, and **monotonic within a run**: it never decreases, even when an
   * unplanned step widens the total. Capped at 0.95 while anything is still
   * pending, so a full bar never sits beside a still-loading sketch.
   */
  progress: number;
  /** `true` once every opened step has settled. */
  settled: boolean;
};

type Subscriber = ( snapshot: LoadingProgressSnapshot ) => void;

let steps: LoadingStep[] = [];
let nextId = 1;
let plan: LoadingPlan = {};
let plannedTotal = 0;
let progressFloor = 0;

const subscribers = new Set<Subscriber>();

// Resolvers of still-pending steps, so a reset can release the promises
// registered with pendingMedia — otherwise steps orphaned by a sketch
// switch would gate deterministic capture forever.
const pendingResolvers = new Set<() => void>();

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function countPending(): number {
  return steps.filter( ( s ) => s.status === "pending" ).length;
}

/**
 * Fold the plan and the opened steps into `progressFloor`.
 *
 * Called at every mutation point *before* `notify()` — deliberately not from
 * `getLoadingProgressSnapshot()`, which must stay a pure read: that getter also
 * runs on each new subscriber, and mutating the floor there would make the
 * reported progress depend on how many things happen to be listening.
 */
function recomputeProgress(): void {
  const pending = countPending();
  const settledCount = steps.length - pending;
  const total = Math.max(
    steps.length,
    plannedTotal
  );

  // "Complete" needs every opened step settled *and* the plan met — otherwise a
  // plan that overshot (warm image cache: those paths open no step at all) would
  // read as finished the moment the few real steps land.
  const complete = steps.length > 0 &&
    pending === 0 &&
    steps.length >= plannedTotal;

  const raw = total === 0 ? 0 : settledCount / total;
  const capped = complete ? 1 : Math.min(
    raw,
    0.95
  );

  if ( capped > progressFloor ) {
    progressFloor = capped;
  }
}

export function getLoadingProgressSnapshot(): LoadingProgressSnapshot {
  const pending = countPending();
  const failed = steps.filter( ( s ) => s.status === "failed" ).length;

  return {
    steps: steps.map( ( s ) => ( {
      ...s
    } ) ),
    pending,
    failed,
    loaded: steps.length - pending - failed,
    planned: plannedTotal,
    total: Math.max(
      steps.length,
      plannedTotal
    ),
    progress: progressFloor,
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
 * Declare how many steps of each kind are expected, before they open, so the
 * first reported total is the real one instead of climbing as loaders start.
 *
 * The default merge only ever *widens* a kind's count (`max`), so two callers
 * declaring the same work cannot deflate each other. Pass `{ exact: true }`
 * from a caller that authoritatively knows the count — `options.js` does, once
 * it has diffed the requested images against the warm cache — to replace it.
 */
export function planLoadingSteps(
  next: LoadingPlan,
  options: { exact?: boolean } = {}
): void {
  for ( const [
    kind,
    count
  ] of Object.entries( next ) ) {
    if ( typeof count !== "number" || !Number.isFinite( count ) || count < 0 ) {
      continue;
    }

    const key = kind as LoadingAssetKind;

    plan[ key ] = options.exact
      ? count
      : Math.max(
        plan[ key ] ?? 0,
        count
      );
  }

  plannedTotal = Object.values( plan ).reduce(
    (
      sum, count
    ) => sum + count,
    0
  );

  recomputeProgress();
  notify();
}

/**
 * Force progress to 1. The engine calls this just before it emits `ready`: a
 * plan that overshot (images already warm in the module-level `cache`, so no
 * step ever opens for them) would otherwise leave the bar stalled part-way as
 * the loading screen disappears.
 */
export function finishLoadingProgress(): void {
  progressFloor = 1;
  notify();
}

/**
 * Drop all recorded steps, the plan and the progress floor. Called by the
 * engine on `init()` so each sketch run reports from a clean slate.
 * Subscribers survive a reset.
 */
export function resetLoadingProgress(): void {
  steps = [];
  plan = {};
  plannedTotal = 0;
  progressFloor = 0;
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
    recomputeProgress();
    notify();
  };

  pendingResolvers.add( resolvePromise );
  trackPendingMedia( promise );
  recomputeProgress();
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
