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
 * - `bare` — canvas only, stretched to the screen resolution. The pre-fullscreen
 *            size is stashed and restored on exit (unless something else changed
 *            it in the meantime).
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

let targetElement: HTMLElement | null = null;
// The mode of the active fullscreen session (null while not fullscreen).
let activeMode: FullscreenMode | null = null;
// The resolution active when we entered a `bare` session, restored on exit.
let sizeBeforeFullscreen: Size | null = null;
// The screen resolution applied on `bare` entry — used to detect whether the
// size was changed by other means while fullscreen (then we keep that change).
let sizeAppliedForFullscreen: Size | null = null;
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

function readCurrentSize(): Size | null {
  const size = getSketchOptions()?.size;

  return size && typeof size.width === "number" && typeof size.height === "number"
    ? {
      width: size.width,
      height: size.height
    }
    : null;
}

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

function notify(): void {
  for ( const cb of subscribers ) {
    cb();
  }
}

function handleFullscreenChange(): void {
  // Left fullscreen (Esc, the menu, or a programmatic exit). A `bare` session
  // stashed a resolution: put it back — but only if the current size still
  // matches what we applied, so a size changed by other means is preserved.
  if ( !isViewportFullscreen() ) {
    if ( sizeBeforeFullscreen ) {
      const currentSize = readCurrentSize();
      const untouched =
        sizeAppliedForFullscreen !== null &&
        currentSize !== null &&
        currentSize.width === sizeAppliedForFullscreen.width &&
        currentSize.height === sizeAppliedForFullscreen.height;

      if ( untouched ) {
        setSketchOptions(
          {
            size: sizeBeforeFullscreen
          },
          FULLSCREEN_ORIGIN
        );
      }
    }

    activeMode = null;
    sizeBeforeFullscreen = null;
    sizeAppliedForFullscreen = null;
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

  const before = readCurrentSize();

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
    sizeBeforeFullscreen = before;
    sizeAppliedForFullscreen = screenResolution();

    setSketchOptions(
      {
        size: sizeAppliedForFullscreen
      },
      FULLSCREEN_ORIGIN
    );
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
