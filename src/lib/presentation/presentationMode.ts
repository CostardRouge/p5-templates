"use client";

/**
 * Presentation mode — three independent axes, not a list of presets.
 *
 * The studio used to ship two opaque "fullscreen" modes (`hud` / `bare`), both
 * calling the Fullscreen API **on the viewport div**. That target is what made
 * them impossible to tell apart: the browser renders nothing but the fullscreen
 * element, so every panel outside the viewport vanished whether or not that was
 * the point. "Fullscreen while keeping the studio panels" could not even be
 * expressed.
 *
 * So the target is now `document.documentElement` (the root layout is already
 * `h-[100svh]`), and what used to be baked into two presets is three flags any
 * combination of which is legal:
 *
 * - `fullscreen`    — the browser Fullscreen API. Desktop-only in practice:
 *                     iOS Safari has no element fullscreen.
 * - `hideInterface` — top bar, rails, filmstrip, transport, global menu bar and
 *                     the in-canvas HUD. A real choice now, not a side effect.
 * - `stretchCanvas` — the canvas resolution follows the surface it is given,
 *                     live, instead of keeping the sketch's own ratio.
 *
 * `stretchCanvas` measures the *registered surface element*, not `window.screen`
 * as the old `bare` mode did. That single change makes "fill the display" and
 * "fill the page" the same code path — the difference is just whether
 * `fullscreen` happens to be on.
 *
 * Like `syncSketchOptions` and `usePanelDock`, the state lives in this module
 * rather than a context: three separate React trees read it (the sketch page,
 * the options form, and the global menu bar in the root layout).
 */

import {
  getSketchOptions,
  setSketchOptions
} from "@/lib/syncSketchOptions";
import {
  exitDocumentFullscreen,
  isDocumentFullscreen,
  isFullscreenSupported,
  requestDocumentFullscreen,
  subscribeFullscreenChange
} from "@/lib/fullscreen/fullscreenViewport";

/** Origin tag kept distinct from "react" so every option bridge picks up our
 *  size writes (SketchContext, the options form, the engine runtimes). */
const PRESENTATION_ORIGIN = "presentation";

/** A resize storm (dragging a window edge) would otherwise restart the
 *  sketch's setup() on every frame. */
const STRETCH_DEBOUNCE_MS = 150;

export type PresentationAxis = "fullscreen" | "hideInterface" | "stretchCanvas";

export type PresentationState = {
  [ axis in PresentationAxis ]: boolean;
};

export type PresentationPreset =
  | "present"
  | "presentSketchRatio"
  | "focus"
  | "fillPage"
  | "cleanPreview";

export const PRESENTATION_PRESETS: Record<PresentationPreset, PresentationState> = {
  // Kiosk / expo: the canvas *is* the screen.
  present: {
    fullscreen: true,
    hideInterface: true,
    stretchCanvas: true
  },
  // The sketch at its own ratio, letterboxed on the display — a 1080×1350 post
  // shown on a 16:9 TV.
  presentSketchRatio: {
    fullscreen: true,
    hideInterface: true,
    stretchCanvas: false
  },
  // Fullscreen *with* the panels: edit big on a laptop. Impossible before.
  focus: {
    fullscreen: true,
    hideInterface: false,
    stretchCanvas: false
  },
  // Canvas over the whole page, still inside the tab — a capture source.
  fillPage: {
    fullscreen: false,
    hideInterface: true,
    stretchCanvas: true
  },
  // Distraction-free preview in the tab, sketch ratio kept.
  cleanPreview: {
    fullscreen: false,
    hideInterface: true,
    stretchCanvas: false
  }
};

const IDLE_STATE: PresentationState = {
  fullscreen: false,
  hideInterface: false,
  stretchCanvas: false
};

type Size = {
  width: number;
  height: number;
};

/** The `size` / `slides` we replaced when the stretch turned on, restored
 *  verbatim when it turns off. */
type SizeSnapshot = {
  size: unknown;
  slides: unknown;
};

let state: PresentationState = {
  ...IDLE_STATE
};

// The element the stretch measures — the sketch viewport, registered by a ref
// callback. Not the fullscreen target: that is always documentElement.
let surfaceElement: HTMLElement | null = null;
let surfaceObserver: ResizeObserver | null = null;
let stretchTimer: ReturnType<typeof setTimeout> | null = null;
let sizeSnapshot: SizeSnapshot | null = null;
// The last size we wrote, so an observer tick that measures no change writes
// nothing: every write changes `resolutionKey`, which re-lays out the viewport
// and restarts the sketch.
let appliedSize: Size | null = null;

const subscribers = new Set<() => void>();

function notify(): void {
  for ( const cb of subscribers ) {
    cb();
  }
}

/* ------------------------------------------------------------------ */
/*  Axis C — stretch the canvas to the surface it is given             */
/* ------------------------------------------------------------------ */

function cloneJson( value: unknown ): unknown {
  return value === undefined ? undefined : JSON.parse( JSON.stringify( value ) );
}

function measureSurface(): Size | null {
  const element = surfaceElement;

  if ( !element ) {
    return null;
  }

  const width = Math.round( element.clientWidth );
  const height = Math.round( element.clientHeight );

  // A hidden or not-yet-laid-out element measures 0 — writing that would blank
  // the canvas and lose the ratio we are meant to restore.
  if ( width < 1 || height < 1 ) {
    return null;
  }

  return {
    width,
    height
  };
}

/**
 * Push `target` into the option store. A slide deck seeds every slide with its
 * own `size`, and `getEffectiveSlideSettings` lets the slide win over the
 * global one — so the slides have to be rewritten too, or the change is masked
 * and the sketch stays at its own ratio.
 */
function writeSize( target: Size ): void {
  const options = getSketchOptions();
  const update: Record<string, unknown> = {
    size: {
      ...target
    }
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
    PRESENTATION_ORIGIN
  );

  appliedSize = target;
}

function applyStretch(): void {
  const target = measureSurface();

  if ( !target ) {
    return;
  }

  if ( appliedSize && appliedSize.width === target.width && appliedSize.height === target.height ) {
    return;
  }

  writeSize( target );
}

function clearStretchTimer(): void {
  if ( stretchTimer !== null ) {
    clearTimeout( stretchTimer );
    stretchTimer = null;
  }
}

function scheduleStretch(): void {
  clearStretchTimer();
  stretchTimer = setTimeout(
    () => {
      stretchTimer = null;
      applyStretch();
    },
    STRETCH_DEBOUNCE_MS
  );
}

function startStretch(): void {
  if ( sizeSnapshot ) {
    return;
  }

  const options = getSketchOptions();

  sizeSnapshot = {
    size: cloneJson( options?.size ),
    slides: cloneJson( options?.slides )
  };
  appliedSize = null;

  // Measure immediately (entering fullscreen or hiding the chrome has already
  // resized the surface), then track it.
  applyStretch();
  observeSurface();
}

function stopStretch(): void {
  clearStretchTimer();
  disconnectObserver();

  const snapshot = sizeSnapshot;

  sizeSnapshot = null;
  appliedSize = null;

  if ( !snapshot ) {
    return;
  }

  const update: Record<string, unknown> = {
    size: snapshot.size
  };

  if ( snapshot.slides !== undefined ) {
    update.slides = snapshot.slides;
  }

  setSketchOptions(
    update,
    PRESENTATION_ORIGIN
  );
}

function disconnectObserver(): void {
  surfaceObserver?.disconnect();
  surfaceObserver = null;
}

function observeSurface(): void {
  disconnectObserver();

  if ( !state.stretchCanvas || !surfaceElement || typeof ResizeObserver === "undefined" ) {
    return;
  }

  surfaceObserver = new ResizeObserver( () => scheduleStretch() );
  surfaceObserver.observe( surfaceElement );
}

/**
 * Register (or clear, with `null`) the element the stretch measures. Called by
 * the sketch viewport via a ref callback — clearing it on unmount restores the
 * sketch's own size, so navigating away never leaves a stretched document
 * behind.
 */
export function registerPresentationSurface( element: HTMLElement | null ): void {
  surfaceElement = element;

  if ( !element ) {
    if ( state.stretchCanvas ) {
      setPresentationState( {
        ...state,
        stretchCanvas: false
      } );
    }

    return;
  }

  if ( state.stretchCanvas ) {
    applyStretch();
    observeSurface();
  }
}

/**
 * The `size` / `slides` the sketch had before the stretch took over, or `null`
 * when the stretch is off.
 *
 * Export reads this so a stretched *preview* never silently repoints an export
 * at the screen resolution: a variant that follows "the sketch's own size"
 * means the size the sketch is authored at, not the one a presentation is
 * borrowing (see `nativeSizeFor`).
 */
export function getPresentationSizeSnapshot(): SizeSnapshot | null {
  return sizeSnapshot;
}

/* ------------------------------------------------------------------ */
/*  Axis A — the browser Fullscreen API                                */
/* ------------------------------------------------------------------ */

// The Fullscreen request must be issued synchronously inside the user gesture,
// before any await, so it is fired here and only reconciled afterwards.
function applyFullscreen( wanted: boolean ): void {
  ensureFullscreenReconciler();

  if ( wanted === isDocumentFullscreen() ) {
    return;
  }

  if ( wanted ) {
    void requestDocumentFullscreen().catch( () => {
      // Rejected (no transient activation, blocked by policy…). The
      // fullscreenchange reconciliation below puts the flag back.
      reconcileFullscreen();
    } );

    return;
  }

  void exitDocumentFullscreen();
}

/** Esc, the browser's own exit, or a rejected request: axis A changed under
 *  us. Only that axis — leaving fullscreen must not tear down a deliberate
 *  "hide interface" or "stretch canvas". */
function reconcileFullscreen(): void {
  const actual = isDocumentFullscreen();

  if ( actual === state.fullscreen ) {
    return;
  }

  state = {
    ...state,
    fullscreen: actual
  };
  notify();
}

// One document-level listener for the whole module: every subscriber wants the
// same reconciliation, and binding it per subscriber would run it N times per
// fullscreenchange.
let fullscreenReconcilerBound = false;

function ensureFullscreenReconciler(): void {
  if ( fullscreenReconcilerBound ) {
    return;
  }

  fullscreenReconcilerBound = true;
  subscribeFullscreenChange( () => {
    reconcileFullscreen();
    notify();
  } );
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

function setPresentationState( next: PresentationState ): void {
  const previous = state;

  if (
    previous.fullscreen === next.fullscreen &&
    previous.hideInterface === next.hideInterface &&
    previous.stretchCanvas === next.stretchCanvas
  ) {
    return;
  }

  // Axis A is not ours to simply assert: only the browser can grant it, and
  // only from a user gesture. Ask, then let reconcileFullscreen correct us.
  const fullscreen = next.fullscreen && !isFullscreenSupported()
    ? false
    : next.fullscreen;

  state = {
    ...next,
    fullscreen
  };

  if ( previous.fullscreen !== fullscreen ) {
    applyFullscreen( fullscreen );
  }

  if ( previous.stretchCanvas !== state.stretchCanvas ) {
    if ( state.stretchCanvas ) {
      startStretch();
    } else {
      stopStretch();
    }
  }

  notify();

  // Hiding the chrome (or going fullscreen) hands the viewport more room; the
  // ResizeObserver will catch it, but measuring once here keeps the canvas from
  // lagging a debounce behind the layout change.
  if ( state.stretchCanvas && previous.hideInterface !== state.hideInterface ) {
    scheduleStretch();
  }
}

export function getPresentationState(): PresentationState {
  return state;
}

export function setPresentationAxis(
  axis: PresentationAxis, on: boolean
): void {
  setPresentationState( {
    ...state,
    [ axis ]: on
  } );
}

export function togglePresentationAxis( axis: PresentationAxis ): void {
  setPresentationAxis(
    axis,
    !state[ axis ]
  );
}

export function applyPresentationPreset( preset: PresentationPreset ): void {
  setPresentationState( {
    ...PRESENTATION_PRESETS[ preset ]
  } );
}

/** Back to plain editing: all three axes off. */
export function exitPresentation(): void {
  setPresentationState( {
    ...IDLE_STATE
  } );
}

/** True when any axis is on — what the "Exit presentation" affordance keys on. */
export function isPresenting(): boolean {
  return state.fullscreen || state.hideInterface || state.stretchCanvas;
}

export function subscribePresentation( cb: () => void ): () => void {
  ensureFullscreenReconciler();
  subscribers.add( cb );

  return () => {
    subscribers.delete( cb );
  };
}

export {
  isFullscreenSupported
};
