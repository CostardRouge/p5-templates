"use client";

/**
 * Viewport fullscreen controller.
 *
 * The official Fullscreen API (`Element.requestFullscreen`) can only be invoked
 * from a user gesture and targets one specific DOM element. Three disconnected
 * parts of the editor need to cooperate around it — the canvas-size select
 * (buried in the options form), the viewport's zoom controls, and the viewport
 * wrapper that actually goes fullscreen — so, mirroring the app's other
 * cross-tree bridges (`syncSketchOptions`, the drawer CustomEvents), the state
 * lives in this one module instead of being threaded through a context.
 *
 * Two modes (see {@link FullscreenMode}):
 * - `hud`  — keep the sketch's on-canvas UI; the canvas keeps its resolution and
 *            is fit into the screen. No resolution change, nothing to restore.
 * - `bare` — a true fullscreen: the canvas is re-sized to the screen resolution
 *            (ratio included), so it fills an external display 1:1 rather than
 *            being letterboxed. Because a slide deck seeds every slide with its
 *            own `size` (which the effective-size resolver lets win over the
 *            global size), we override the global size *and* each slide's size,
 *            snapshotting the originals and restoring them on exit.
 *
 * Desktop-only in practice: iOS Safari has no element fullscreen. Callers gate
 * the UI on {@link isFullscreenSupported} plus a desktop media query.
 */

import {
  getSketchOptions,
  setSketchOptions
} from "@/lib/syncSketchOptions";
import type {
  FullscreenMode
} from "@/lib/fullscreen/constants";

// Origin tag kept distinct from "react" so the option bridges (SketchContext,
// TemplateOptions form, engine runtimes) all pick up our size writes.
const FULLSCREEN_ORIGIN = "fullscreen";

type Size = {
  width: number;
  height: number;
};

// The `size` / `slides` we replaced on `bare` entry, restored verbatim on exit.
type SizeSnapshot = {
  size: unknown;
  slides: unknown;
};

let targetElement: HTMLElement | null = null;
// The mode of the active fullscreen session (null while not fullscreen).
let activeMode: FullscreenMode | null = null;
let bareSizeSnapshot: SizeSnapshot | null = null;
let changeListenerBound = false;

const subscribers = new Set<() => void>();

/* ---- vendor-prefixed Fullscreen API shims (Safari uses webkit*) ---- */

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement(): Element | null {
  if ( typeof document === "undefined" ) {
    return null;
  }

  const doc = document as WebkitDocument;

  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function requestElementFullscreen( element: HTMLElement ): Promise<void> {
  const el = element as WebkitElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;

  if ( !request ) {
    return Promise.reject( new Error( "Fullscreen API unavailable" ) );
  }

  return Promise.resolve( request.call( el ) );
}

function exitDocumentFullscreen(): Promise<void> {
  const doc = document as WebkitDocument;
  const exit = document.exitFullscreen ?? doc.webkitExitFullscreen;

  if ( !exit ) {
    return Promise.resolve();
  }

  return Promise.resolve( exit.call( document ) );
}

/**
 * Whether the browser exposes a usable element-fullscreen API *and* allows it
 * (it is disabled inside iframes without `allow="fullscreen"`, e.g. some
 * embeds). Safe to call during SSR — returns `false`.
 */
export function isFullscreenSupported(): boolean {
  if ( typeof document === "undefined" || typeof Element === "undefined" ) {
    return false;
  }

  const doc = document as WebkitDocument;
  const enabled = document.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  const proto = Element.prototype as WebkitElement;
  const requestable = Boolean( proto.requestFullscreen || proto.webkitRequestFullscreen );

  return Boolean( enabled && requestable );
}

/** True while our registered viewport element is the active fullscreen element. */
export function isViewportFullscreen(): boolean {
  return targetElement !== null && currentFullscreenElement() === targetElement;
}

/** The active fullscreen mode, or `null` when the viewport is not fullscreen. */
export function getFullscreenMode(): FullscreenMode | null {
  return isViewportFullscreen() ? activeMode : null;
}

function cloneJson( value: unknown ): unknown {
  return value === undefined ? undefined : JSON.parse( JSON.stringify( value ) );
}

// The screen's logical resolution. A future "×2 / ×3" supersampling option
// would multiply this; for now the canvas matches the display 1:1.
function screenResolution(): Size {
  if ( typeof window === "undefined" ) {
    return {
      width: 1920,
      height: 1080
    };
  }

  const screen = window.screen;

  return {
    width: Math.round( screen?.width || window.innerWidth ),
    height: Math.round( screen?.height || window.innerHeight )
  };
}

// Stretch the canvas to the screen resolution. The effective size a slide deck
// renders at is `mergeSlideOverride(global, slide.size)` with the slide winning,
// so we have to rewrite each slide's size too — otherwise the change is masked
// and the sketch stays at its own ratio.
function applyScreenResolution(): void {
  const options = getSketchOptions();

  bareSizeSnapshot = {
    size: cloneJson( options?.size ),
    slides: cloneJson( options?.slides )
  };

  const target = screenResolution();
  const update: Record<string, unknown> = {
    size: target
  };
  const slides = options?.slides;

  if ( Array.isArray( slides ) && slides.length > 0 ) {
    update.slides = slides.map( ( slide ) =>
      slide && typeof slide === "object"
        ? {
          ...slide,
          size: {
            ...target
          }
        }
        : slide );
  }

  setSketchOptions(
    update,
    FULLSCREEN_ORIGIN
  );
}

function restoreResolution(): void {
  if ( !bareSizeSnapshot ) {
    return;
  }

  const update: Record<string, unknown> = {
    size: bareSizeSnapshot.size
  };

  if ( bareSizeSnapshot.slides !== undefined ) {
    update.slides = bareSizeSnapshot.slides;
  }

  setSketchOptions(
    update,
    FULLSCREEN_ORIGIN
  );

  bareSizeSnapshot = null;
}

function notify(): void {
  for ( const cb of subscribers ) {
    cb();
  }
}

function handleFullscreenChange(): void {
  // Left fullscreen (Esc, the menu, or a programmatic exit): a `bare` session
  // rewrote the canvas size — put the snapshot back.
  if ( !isViewportFullscreen() ) {
    restoreResolution();
    activeMode = null;
  }

  notify();
}

function ensureChangeListener(): void {
  if ( changeListenerBound || typeof document === "undefined" ) {
    return;
  }

  changeListenerBound = true;
  document.addEventListener(
    "fullscreenchange",
    handleFullscreenChange
  );
  document.addEventListener(
    "webkitfullscreenchange",
    handleFullscreenChange
  );
}

/**
 * Register (or clear, with `null`) the element that should go fullscreen. Called
 * by the viewport wrapper via a ref callback.
 */
export function registerFullscreenTarget( element: HTMLElement | null ): void {
  targetElement = element;

  if ( element ) {
    ensureChangeListener();
  }
}

/**
 * Enter fullscreen on the registered viewport in the given mode. In `bare` mode
 * the canvas is stretched to the screen resolution; `hud` leaves the resolution
 * untouched. Must be called from within a user gesture (the request is issued
 * synchronously before the first `await`).
 */
export async function enterViewportFullscreen( mode: FullscreenMode ): Promise<void> {
  if ( !targetElement || !isFullscreenSupported() || isViewportFullscreen() ) {
    return;
  }

  try {
    await requestElementFullscreen( targetElement );
  } catch {
    // Rejected (no transient activation, blocked by policy, …) — leave the
    // resolution untouched so the sketch stays exactly as it was.
    return;
  }

  // Guard against a request that resolved without actually entering.
  if ( !isViewportFullscreen() ) {
    return;
  }

  activeMode = mode;

  if ( mode === "bare" ) {
    applyScreenResolution();
  }

  notify();
}

/** Leave fullscreen. Any resolution restore happens on `fullscreenchange`. */
export async function exitViewportFullscreen(): Promise<void> {
  if ( !isViewportFullscreen() ) {
    return;
  }

  try {
    await exitDocumentFullscreen();
  } catch {
    // Ignore — the change handler still reconciles state if we did exit.
  }
}

/** Subscribe to fullscreen-state changes (drives `useFullscreenViewport`). */
export function subscribeFullscreen( cb: () => void ): () => void {
  subscribers.add( cb );
  ensureChangeListener();

  return () => {
    subscribers.delete( cb );
  };
}
