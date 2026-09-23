// ── Pure channel adapter ────────────────────────────────────────────────────
// The pure part of the interaction→channel mapping, split out from channels.js
// so it is unit-testable WITHOUT importing the heavy interaction handler module
// (index.js → MediaPipe). channels.js imports these.

import {
  MIDI_CC_PREFIX, MIDI_CC_LAST_ID, MIDI_NOTE_PREFIX
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
 * → raw 0–127 value — onto one `midi.cc<n>` scalar channel per CC number the
 * controller has actually sent, plus `midi.ccLast` for the one that moved most
 * recently. Values are divided by 127 so the binding resolver receives the
 * 0..1 signal every other scalar channel publishes.
 *
 * The channel set is therefore GROWN FROM THE HARDWARE, not declared: whatever
 * CC number a knob sends becomes bindable the first time it is touched. A
 * guessed list cannot do this — see MIDI_CC_PREFIX in sources.js for the
 * Launchkey mapping that proves it.
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

  if ( !controls || typeof controls.forEach !== "function" ) {
    return channels;
  }

  controls.forEach( (
    value, cc
  ) => {
    if ( typeof value === "number" ) {
      channels[ `${ MIDI_CC_PREFIX }${ cc }` ] = {
        type: "scalar",
        value: clamp01( value / 127 )
      };
    }
  } );

  const lastValue = typeof controls.get === "function"
    ? controls.get( lastControl )
    : undefined;

  if ( typeof lastValue === "number" ) {
    channels[ MIDI_CC_LAST_ID ] = {
      type: "scalar",
      value: clamp01( lastValue / 127 )
    };
  }

  return channels;
}

/**
 * Map note levels — `getMidiNoteLevels()`, a Map of note number → velocity
 * while held, 0 once released — onto one `midi.note<n>` scalar channel per note
 * the controller has actually sent. Same policy as the CC channels: a note
 * never received publishes NO channel, so an untouched pad leaves a boolean
 * binding on its base value and a headless render sees no pad at all.
 *
 * The 0 after release is kept on purpose. A pad is a pulse, and a trigger
 * listening for its rising edge can only re-arm once it has seen the fall.
 *
 * @param {Map<number, number> | null | undefined} levels
 * @returns {Record<string, { type: "scalar", value: number }>}
 */
export function midiNoteChannels( levels ) {
  const channels = {};

  if ( !levels || typeof levels.forEach !== "function" ) {
    return channels;
  }

  levels.forEach( (
    level, note
  ) => {
    if ( typeof level === "number" ) {
      channels[ `${ MIDI_NOTE_PREFIX }${ note }` ] = {
        type: "scalar",
        value: clamp01( level / 127 )
      };
    }
  } );

  return channels;
}
