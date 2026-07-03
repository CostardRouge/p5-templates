import sketch, {
  getP5
} from "../sketch.js";

// ── Raw mouse / touch tracking + canvas-space conversion ───────────────────
// The window-listener layer that feeds every pointer consumer. Split out of
// interaction/index.js so lightweight users (the draggable helper, the
// engine's content-item drag) can track pointers WITHOUT pulling the full
// interaction module — and its MediaPipe import — into the core module-eval
// chain (see initInteractionForOptions in options.js, which loads that module
// lazily for the same reason).
//
// Raw clientX/Y is tracked here and converted through getBoundingClientRect()
// so canvas-space coordinates are correct even when the canvas is panned /
// zoomed inside ScalableViewport (CSS transform on the parent doesn't affect
// the formula).

const _rawMouse = {
  clientX: null,
  clientY: null
};
let _rawTouches = []; // Array of { clientX, clientY }

let _pointerMoveListener = null;
let _touchListeners = null;

// Read by interaction/index.js' mouse/touch collectors.
export function getRawMouse() {
  return _rawMouse;
}

export function getRawTouches() {
  return _rawTouches;
}

/**
 * Wire the raw mouse/touch window listeners if they aren't wired yet.
 * Idempotent — safe to call every frame.
 */
export function ensurePointerTracking() {
  if ( typeof window === "undefined" ) {
    return;
  }

  if ( !_pointerMoveListener ) {
    _pointerMoveListener = ( e ) => {
      _rawMouse.clientX = e.clientX;
      _rawMouse.clientY = e.clientY;
    };
    window.addEventListener(
      "pointermove",
      _pointerMoveListener,
      {
        passive: true
      }
    );
  }

  if ( !_touchListeners ) {
    const _onTouch = ( e ) => {
      _rawTouches = Array.from( e.touches ).map( ( t ) => ( {
        clientX: t.clientX,
        clientY: t.clientY
      } ) );
    };

    _touchListeners = {
      fn: _onTouch
    };
    window.addEventListener(
      "touchstart",
      _onTouch,
      {
        passive: true
      }
    );
    window.addEventListener(
      "touchmove",
      _onTouch,
      {
        passive: true
      }
    );
    window.addEventListener(
      "touchend",
      _onTouch,
      {
        passive: true
      }
    );
  }
}

/**
 * Remove the listeners and clear the tracked state. Called when a sketch is
 * torn down (disposeInteraction) and before initInteraction re-wires so a
 * fresh sketch starts clean.
 */
export function removePointerTracking() {
  if ( typeof window === "undefined" ) {
    return;
  }

  if ( _pointerMoveListener ) {
    window.removeEventListener(
      "pointermove",
      _pointerMoveListener
    );
    _pointerMoveListener = null;
  }

  _rawMouse.clientX = null;
  _rawMouse.clientY = null;

  if ( _touchListeners ) {
    window.removeEventListener(
      "touchstart",
      _touchListeners.fn
    );
    window.removeEventListener(
      "touchmove",
      _touchListeners.fn
    );
    window.removeEventListener(
      "touchend",
      _touchListeners.fn
    );
    _touchListeners = null;
  }

  _rawTouches = [];
}

/**
 * Convert viewport-space client coordinates to p5 canvas-space coordinates,
 * honouring the ScalableViewport pan/zoom. The rect is resolved fresh — this
 * is meant for DOM event handlers, which run between frames when a per-frame
 * cache may be stale (e.g. a paused loop). Returns null when no canvas is
 * available.
 */
export function clientToCanvas(
  clientX, clientY
) {
  const p = getP5();
  const rect = _canvasRect();

  if ( !p || !rect ) {
    return null;
  }

  return _convert(
    rect,
    p,
    clientX,
    clientY
  );
}

function _canvasRect() {
  if ( typeof document === "undefined" ) {
    return null;
  }

  // Prefer the exact node the running sketch owns, so the rect used for the
  // hit-test always matches the element the content-drag identity check accepts
  // (event.target === sketch.getCanvasElement()). Falling back to a class
  // lookup would risk resolving a DIFFERENT canvas.p5Canvas (an incompletely
  // torn-down previous sketch, or an attached graphics buffer) — a divergent
  // rect makes clientToCanvas mis-map the pointer and every hit-test miss.
  const canvas = sketch.getCanvasElement?.() ?? document.querySelector( "canvas.p5Canvas" );
  const rect = canvas?.getBoundingClientRect();

  if ( !rect || rect.width === 0 || rect.height === 0 ) {
    return null;
  }

  return rect;
}

function _convert(
  rect, p, clientX, clientY
) {
  return {
    x: ( clientX - rect.left ) * ( p.width / rect.width ),
    y: ( clientY - rect.top ) * ( p.height / rect.height )
  };
}

/**
 * How many canvas-internal pixels one on-screen (CSS) pixel spans right now —
 * i.e. `canvasInternalWidth / canvasDisplayWidth`. On a phone the canvas is a
 * 1080-wide buffer squeezed into ~380 CSS px, so this is ~2.8; on desktop
 * unzoomed it's ~1; zoomed in it drops below 1. Multiply a desired SCREEN-space
 * hit radius by this to get the equivalent radius in the canvas-pixel space
 * that the drag math works in, so a grab target stays the same physical size on
 * every device instead of collapsing to a few pixels on mobile. Returns 1 when
 * no canvas is measurable (harmless no-op scaling).
 */
export function getCanvasDisplayScale() {
  const p = getP5();
  const rect = _canvasRect();

  if ( !p || !rect ) {
    return 1;
  }

  // Width and height scale together under the viewport's uniform transform;
  // width alone is representative.
  return p.width / rect.width;
}

/**
 * Mouse + touch pointer groups, always on, in the same shape as the full
 * interaction layer's getPointerGroups() (no smoothing, no offsets).
 * Deliberately does NOT touch the vision/MIDI/audio machinery — that stays
 * reconciled by the sketch's own interaction options — so engine-level layers
 * can call this every frame without fighting the sketch. The mouse is omitted
 * until it has moved at least once (no phantom pointer at 0,0).
 */
export function getBasicPointerGroups() {
  const p = getP5();

  if ( !p ) {
    return [];
  }

  ensurePointerTracking();

  // One rect for every pointer this call — getBoundingClientRect can force a
  // layout pass, so it isn't resolved per pointer.
  const rect = _canvasRect();

  if ( !rect ) {
    return [];
  }

  const groups = [];

  if ( _rawMouse.clientX !== null ) {
    groups.push( {
      source: "mouse",
      id: "mouse-0",
      points: [
        _convert(
          rect,
          p,
          _rawMouse.clientX,
          _rawMouse.clientY
        )
      ]
    } );
  }

  _rawTouches.forEach( (
    touch, index
  ) => {
    groups.push( {
      source: "touch",
      id: `touch-${ index }`,
      points: [
        _convert(
          rect,
          p,
          touch.clientX,
          touch.clientY
        )
      ]
    } );
  } );

  return groups;
}
