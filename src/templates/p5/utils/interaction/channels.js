// ── Interaction channels (the binding system's input layer) ─────────────────
// A "channel" is the addressable unit a binding can read from. Each channel
// publishes a NORMALIZED value (0..1, or an {x,y} both in 0..1) so the binding
// mapping pipeline can map it onto any target range uniformly.
//
// Sources are NOT hardcoded here — they are reused from the interaction handler
// module (`index.js`): `getPointersDebug(opts.interaction)` already samples every
// enabled source (mouse, touch, hands, face, body, orbit, perlinNoise,
// gyroscope, midi, audio, joypad) and tags each with its source name. We just
// normalize those canvas-space vectors to 0..1 and expose them by source id, so
// enhancing a handler automatically makes it bindable. Semantic audio scalars
// (level/bass/treble) come from `getAudio()`.
//
// A lightweight baseline `mouse` channel is always present (its own pointer
// listener) so sketches WITHOUT an interaction block can still bind the mouse.
//
// Generators (oscillator, ramp, sequence, noise, random) are NOT sampled here —
// they are computed from the sketch's animation progression in the resolver.
//
// Determinism: live channels (camera/mic/mouse/gyro) don't reproduce in a
// server render — the same pre-existing caveat as the mouse binding and the live
// HUD. Generators remain the recording-safe path.

import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  AUDIO_BANDS
} from "./sources.js";
import {
  clamp01, buildChannelsFromDebug
} from "./channelsAdapter.js";

// Re-export so consumers (and tests) can reach the pure adapter via channels.js.
export {
  buildChannelsFromDebug
};

// The interaction handler (index.js → MediaPipe/audio) is loaded LAZILY, never
// statically: a static import would pull MediaPipe into the core module-eval
// chain (events → … → options → channels), where mediapipe.js's top-level
// `events.register` runs before `events` is initialized. Loading on first use
// (when a sketch actually has an interaction block) also keeps non-interaction
// sketches off the MediaPipe bundle entirely.
let _interaction = null;
let _interactionLoading = false;

function _ensureInteractionModule() {
  if ( _interaction || _interactionLoading ) {
    return;
  }

  _interactionLoading = true;
  import( "./index.js" )
    .then( ( mod ) => {
      _interaction = mod;
    } )
    .catch( () => {} )
    .finally( () => {
      _interactionLoading = false;
    } );
}

// ── Raw pointer tracking (baseline mouse) ───────────────────────────────────
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
    x: clamp01( ( _rawPointer.clientX - rect.left ) / rect.width ),
    y: clamp01( ( _rawPointer.clientY - rect.top ) / rect.height )
  };
}

// Semantic audio scalar channels from getAudio().bands (each already 0..1).
// `audio.level` is the mean of the available bands. Populated only when the
// sketch enabled `interaction.audio` with band features.
function _collectAudioChannels(
  interactionOpts, channels
) {
  if ( !interactionOpts.audio?.enabled || !_interaction ) {
    return;
  }

  const bands = _interaction.getAudio()?.bands;

  if ( !bands ) {
    return;
  }

  let sum = 0;
  let count = 0;

  for ( const name of AUDIO_BANDS ) {
    const value = bands[ name ];

    if ( typeof value === "number" ) {
      channels[ `audio.${ name }` ] = {
        type: "scalar",
        value: clamp01( value )
      };
      sum += value;
      count += 1;
    }
  }

  channels[ "audio.level" ] = {
    type: "scalar",
    value: count > 0 ? clamp01( sum / count ) : 0
  };
}

// ── Per-frame sampling ──────────────────────────────────────────────────────
// Channels are sampled at most once per rendered frame and cached, so multiple
// binding reads in the same draw() see a consistent snapshot (and stateful
// collectors like perlin only advance once per frame).
let _cache = {
  frame: -1,
  channels: null
};

/**
 * Sample every channel for the current frame.
 *
 * @param {object} [interactionOpts] - the sketch's `interaction` options block;
 *   when present and enabled, the handler's sources are overlaid onto the
 *   baseline mouse channel.
 * @returns {Record<string, { type: "vector2d", x: number, y: number }
 *                          | { type: "scalar", value: number }>}
 */
export function sampleChannels( interactionOpts ) {
  _ensurePointerListener();

  const p = getP5();
  const frame = p?.frameCount ?? -1;

  if ( _cache.frame === frame && _cache.channels ) {
    return _cache.channels;
  }

  const pointer = _pointerFraction();

  // Baseline mouse — always available, no interaction block required.
  const channels = {
    mouse: {
      type: "vector2d",
      x: pointer.x,
      y: pointer.y
    }
  };

  // Overlay the interaction handler's sources when the sketch opts in. The
  // module loads lazily on first use, so the first few interaction frames fall
  // back to the baseline mouse until it's ready.
  if ( interactionOpts && interactionOpts.enabled !== false && p ) {
    _ensureInteractionModule();

    if ( _interaction ) {
      try {
        Object.assign(
          channels,
          buildChannelsFromDebug(
            _interaction.getPointersDebug( interactionOpts ),
            p.width,
            p.height
          )
        );
        _collectAudioChannels(
          interactionOpts,
          channels
        );
      } catch {
        // A misbehaving source must never break the sketch.
      }
    }
  }

  _cache = {
    frame,
    channels
  };

  return channels;
}
