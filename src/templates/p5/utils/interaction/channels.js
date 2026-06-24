// ── Interaction channels (MVP) ──────────────────────────────────────────────
// A "channel" is the addressable unit a binding can read from. Each channel
// publishes a NORMALIZED value (0..1, or an {x,y} both in 0..1) so the binding
// mapping pipeline can map it onto any target range uniformly, regardless of
// the source's native units.
//
// This MVP intentionally ships a tiny, dependency-light channel set (mouse +
// a free-running oscillator) so the binding mechanism can be proven end to end
// without pulling the camera / MediaPipe stack onto the global options hot
// path. Richer channels (audio, gyro, hands.pinch, midi.cc, …) plug in here
// later by extending `sampleChannels` and `CHANNEL_DESCRIPTORS`.

import {
  getP5
} from "@/p5/utils/sketch.js";

// ── Static manifest (for the future binding UI catalogue) ───────────────────
// `type` drives which projections / mappings the binding UI offers:
//   vector2d → projections x | y | mag | angle, or whole-vector passthrough
//   scalar   → used directly by the continuous mapping family
export const CHANNEL_DESCRIPTORS = [
  {
    id: "mouse",
    type: "vector2d",
    label: "Mouse"
  },
  {
    id: "osc",
    type: "scalar",
    label: "Oscillator (sine)"
  }
];

// ── Raw pointer tracking ────────────────────────────────────────────────────
// Tracked via a window listener so coordinates stay correct even when the
// canvas is panned/zoomed inside ScalableViewport (CSS transform on a parent).
let _listening = false;
const _rawPointer = {
  clientX: null,
  clientY: null
};

function _ensurePointerListener() {
  if ( _listening || typeof window === "undefined" ) {
    return;
  }

  _listening = true;

  const onMove = ( e ) => {
    _rawPointer.clientX = e.clientX;
    _rawPointer.clientY = e.clientY;
  };

  window.addEventListener(
    "pointermove",
    onMove,
    {
      passive: true
    }
  );
}

// Convert viewport clientX/clientY to a 0..1 fraction of the p5 canvas, honoring
// any CSS transform on the canvas's ancestors via getBoundingClientRect().
function _pointerFraction() {
  if ( typeof document === "undefined" || _rawPointer.clientX === null ) {
    return {
      x: 0.5,
      y: 0.5
    };
  }

  const canvas = document.querySelector( "canvas.p5Canvas" );

  if ( !canvas ) {
    return {
      x: 0.5,
      y: 0.5
    };
  }

  const rect = canvas.getBoundingClientRect();

  if ( rect.width === 0 || rect.height === 0 ) {
    return {
      x: 0.5,
      y: 0.5
    };
  }

  return {
    x: _clamp01( ( _rawPointer.clientX - rect.left ) / rect.width ),
    y: _clamp01( ( _rawPointer.clientY - rect.top ) / rect.height )
  };
}

function _clamp01( v ) {
  if ( v < 0 ) {
    return 0;
  }

  if ( v > 1 ) {
    return 1;
  }

  return v;
}

// ── Per-frame sampling ──────────────────────────────────────────────────────
// Channels are sampled at most once per rendered frame and cached, so multiple
// binding reads in the same draw() see a consistent snapshot (and any future
// stateful channel — e.g. perlin — only advances once per frame).
let _cache = {
  frame: -1,
  channels: null
};

const OSC_SPEED = 0.03; // radians per frame → ~one cycle every ~3.5s at 60fps

/**
 * Sample every channel for the current frame.
 *
 * @returns {Record<string, { type: "vector2d", x: number, y: number }
 *                          | { type: "scalar", value: number }>}
 */
export function sampleChannels() {
  _ensurePointerListener();

  const p = getP5();
  const frame = p?.frameCount ?? -1;

  if ( _cache.frame === frame && _cache.channels ) {
    return _cache.channels;
  }

  const pointer = _pointerFraction();
  const phase = ( frame < 0 ? 0 : frame ) * OSC_SPEED;

  const channels = {
    mouse: {
      type: "vector2d",
      x: pointer.x,
      y: pointer.y
    },
    osc: {
      type: "scalar",
      value: ( Math.sin( phase ) + 1 ) / 2
    }
  };

  _cache = {
    frame,
    channels
  };

  return channels;
}
