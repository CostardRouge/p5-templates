// ── Pure channel adapter ────────────────────────────────────────────────────
// The pure part of the interaction→channel mapping, split out from channels.js
// so it is unit-testable WITHOUT importing the heavy interaction handler module
// (index.js → MediaPipe). channels.js imports these.

import {
  MIDI_CC_NUMBERS, MIDI_CC_LAST_ID
} from "./sources.js";

export function clamp01( v ) {
  if ( v < 0 ) {
    return 0;
  }

  if ( v > 1 ) {
    return 1;
  }

  return v;
}

/**
 * Map `getPointersDebug()` output — `[{ vector, source }]` in canvas-pixel
 * space — to normalized vector2d channels keyed by source. Keeps the FIRST
 * vector per source (indexed channels like hands.0 / audio.band.N are a future
 * follow-up) and normalizes each by the canvas dimensions. Out-of-canvas
 * vectors clamp to 0..1; a zero-sized canvas falls back to the center.
 *
 * @param {Array<{ vector: { x: number, y: number }, source: string }>} tagged
 * @param {number} width
 * @param {number} height
 * @returns {Record<string, { type: "vector2d", x: number, y: number }>}
 */
export function buildChannelsFromDebug(
  tagged, width, height
) {
  const channels = {};

  if ( !Array.isArray( tagged ) ) {
    return channels;
  }

  const safe = width > 0 && height > 0;

  for ( const item of tagged ) {
    if ( !item || !item.source || channels[ item.source ] ) {
      continue; // first vector per source wins
    }

    const v = item.vector;

    if ( !v ) {
      continue;
    }

    channels[ item.source ] = safe
      ? {
        type: "vector2d",
        x: clamp01( v.x / width ),
        y: clamp01( v.y / height )
      }
      : {
        type: "vector2d",
        x: 0.5,
        y: 0.5
      };
  }

  return channels;
}

/**
 * Map held MIDI control-change state — `getMidiControls()`, a Map of CC number
 * → raw 0–127 value — onto `midi.cc<n>` scalar channels, plus `midi.ccLast`
 * for the CC that moved most recently. Values are divided by 127 so the binding
 * resolver receives the 0..1 signal every other scalar channel publishes.
 *
 * A CC with no entry publishes NO channel, rather than a zero: an untouched
 * knob must leave the parameter on its base value (and in a headless render,
 * where no controller exists, that is every knob — the same policy the
 * microphone-backed `audio.*` channels follow, which is what keeps an export
 * from depending on hardware being plugged in).
 *
 * @param {Map<number, number> | null | undefined} controls
 * @param {number} [lastControl] - the most recently moved CC number (-1 = none)
 * @returns {Record<string, { type: "scalar", value: number }>}
 */
export function midiControlChannels(
  controls, lastControl
) {
  const channels = {};

  if ( !controls || typeof controls.get !== "function" ) {
    return channels;
  }

  for ( const cc of MIDI_CC_NUMBERS ) {
    const value = controls.get( cc );

    if ( typeof value === "number" ) {
      channels[ `midi.cc${ cc }` ] = {
        type: "scalar",
        value: clamp01( value / 127 )
      };
    }
  }

  const lastValue = controls.get( lastControl );

  if ( typeof lastValue === "number" ) {
    channels[ MIDI_CC_LAST_ID ] = {
      type: "scalar",
      value: clamp01( lastValue / 127 )
    };
  }

  return channels;
}
