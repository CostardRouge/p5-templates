/**
 * Editor UI sound feedback — a pleasing click whenever a template option
 * value changes in the options panel, plus a confirmation click on the
 * action buttons (reset / randomize / save defaults / …).
 *
 * Deliberately separate from the sketch audio engine: this module owns its
 * own AudioContext that is NEVER registered on the audio bridge, so panel
 * feedback can't leak into browser or server recordings. The DSP itself is
 * shared with the sketch side through `@/lib/clickSynth`.
 *
 * Settings persist in localStorage and are observable through `subscribe`,
 * so React components can bind with useSyncExternalStore.
 */

import {
  CLICK_PRESET_NAMES,
  type ClickPresetName,
  scheduleClick
} from "@/lib/clickSynth";

export interface UiSoundSettings {
  /** Master switch for value-change clicks. */
  enabled: boolean;
  /** Also click when an action button (reset / randomize / …) is pressed. */
  actionSounds: boolean;
  /** Voice from the shared click synth. */
  preset: ClickPresetName;
  /** 0..1 master volume. */
  volume: number;
  /** Global pitch multiplier (0.5..2 is the sensible range). */
  pitch: number;
  /** Random per-click detune 0..1 (1 ≈ ±half an octave). */
  pitchVariation: number;
  /**
   * Derive a stable pitch offset from the field's path, so dragging the same
   * slider always ticks at the same tone and different fields sound distinct.
   */
  pitchByField: boolean;
  /** Minimum gap between clicks in ms — throttles slider drags. */
  minGapMs: number;
  /** Clicks per change event: 1 = single click, >1 = a small burst. */
  repeatTimes: number;
  /** Gap between burst clicks in ms. */
  repeatIntervalMs: number;
  /** Pitch ramp per burst click, in octaves. */
  repeatPitchStep: number;
}

export const UI_SOUND_PRESETS = CLICK_PRESET_NAMES;

export const UI_SOUND_DEFAULTS: UiSoundSettings = {
  enabled: false,
  actionSounds: true,
  preset: "click",
  volume: 0.4,
  pitch: 1,
  pitchVariation: 0.08,
  pitchByField: true,
  minGapMs: 45,
  repeatTimes: 1,
  repeatIntervalMs: 70,
  repeatPitchStep: 0.08
};

const STORAGE_KEY = "p5templates.uiSound.v1";

let settings: UiSoundSettings | null = null;
const listeners = new Set<() => void>();

function sanitize( raw: unknown ): UiSoundSettings {
  const candidate = ( raw ?? {} ) as Partial<UiSoundSettings>;
  const clamp = (
    value: unknown, min: number, max: number, fallback: number
  ) =>
    typeof value === "number" && Number.isFinite( value )
      ? Math.min(
        max,
        Math.max(
          min,
          value
        )
      )
      : fallback;

  return {
    enabled:
      typeof candidate.enabled === "boolean"
        ? candidate.enabled
        : UI_SOUND_DEFAULTS.enabled,
    actionSounds:
      typeof candidate.actionSounds === "boolean"
        ? candidate.actionSounds
        : UI_SOUND_DEFAULTS.actionSounds,
    preset: ( CLICK_PRESET_NAMES as readonly string[] ).includes( candidate.preset as string )
      ? ( candidate.preset as ClickPresetName )
      : UI_SOUND_DEFAULTS.preset,
    volume: clamp(
      candidate.volume,
      0,
      1,
      UI_SOUND_DEFAULTS.volume
    ),
    pitch: clamp(
      candidate.pitch,
      0.25,
      4,
      UI_SOUND_DEFAULTS.pitch
    ),
    pitchVariation: clamp(
      candidate.pitchVariation,
      0,
      1,
      UI_SOUND_DEFAULTS.pitchVariation
    ),
    pitchByField:
      typeof candidate.pitchByField === "boolean"
        ? candidate.pitchByField
        : UI_SOUND_DEFAULTS.pitchByField,
    minGapMs: clamp(
      candidate.minGapMs,
      0,
      500,
      UI_SOUND_DEFAULTS.minGapMs
    ),
    repeatTimes: Math.round( clamp(
      candidate.repeatTimes,
      1,
      8,
      UI_SOUND_DEFAULTS.repeatTimes
    ) ),
    repeatIntervalMs: clamp(
      candidate.repeatIntervalMs,
      20,
      500,
      UI_SOUND_DEFAULTS.repeatIntervalMs
    ),
    repeatPitchStep: clamp(
      candidate.repeatPitchStep,
      -0.5,
      0.5,
      UI_SOUND_DEFAULTS.repeatPitchStep
    )
  };
}

export function getUiSoundSettings(): UiSoundSettings {
  ensureGestureListeners();

  if ( settings ) {
    return settings;
  }

  let stored: unknown = null;

  if ( typeof window !== "undefined" ) {
    try {
      const raw = window.localStorage.getItem( STORAGE_KEY );

      stored = raw ? JSON.parse( raw ) : null;
    } catch {
      stored = null;
    }
  }

  settings = sanitize( stored );

  return settings;
}

export function setUiSoundSettings( patch: Partial<UiSoundSettings> ): UiSoundSettings {
  settings = sanitize( {
    ...getUiSoundSettings(),
    ...patch
  } );

  if ( typeof window !== "undefined" ) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify( settings )
      );
    } catch {
      // Private mode / quota — settings just won't persist.
    }
  }

  for ( const listener of listeners ) {
    listener();
  }

  return settings;
}

/** useSyncExternalStore-compatible subscription. */
export function subscribeUiSoundSettings( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

/* ------------------------------------------------------------------ */
/*  Playback                                                           */
/* ------------------------------------------------------------------ */

let _context: AudioContext | null = null;
let _masterGain: GainNode | null = null;
let _lastClickAt = -Infinity;
let _suppressDepth = 0;

/**
 * Run a batch of programmatic form updates without emitting UI clicks.
 *
 * Value changes driven by code — the sketch pushing its options back into the
 * form, mount-time normalization, etc. — flow through the same `watch()`
 * callback as real user edits and carry a field name, so they would otherwise
 * click. Wrap those updates in this scope so only genuine user interaction is
 * audible. Runs synchronously: react-hook-form fires its watch subscription
 * inside `setValue`, so the flag is set for the whole batch.
 */
export function withUiSoundSuppressed<T>( fn: () => T ): T {
  _suppressDepth++;

  try {
    return fn();
  } finally {
    _suppressDepth--;
  }
}

/* ------------------------------------------------------------------ */
/*  User-gesture gate                                                  */
/* ------------------------------------------------------------------ */

/**
 * A form value can change for two reasons: the user moved a control, or code
 * wrote it (the sketch syncing its options back on open, a field normalizing
 * itself on mount, a preset expanding, …). Both flow through the same RHF
 * `watch()` callback and both carry a field name, so name alone can't tell
 * them apart. What can: react-hook-form's `setValue` never dispatches a DOM
 * event, whereas every real edit is driven by a genuine pointer / key / input
 * gesture. We remember when the last such gesture happened and only click for
 * changes that land within a short window of one — so opening a sketch (pure
 * programmatic writes, no gesture) stays silent.
 */
const USER_GESTURE_WINDOW_MS = 700;

let _lastGestureAt = -Infinity;
let _pointerDown = false;
let _gestureListenersAttached = false;

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function markGesture(): void {
  _lastGestureAt = nowMs();
}

function ensureGestureListeners(): void {
  if ( _gestureListenersAttached || typeof window === "undefined" ) {
    return;
  }

  _gestureListenersAttached = true;

  const opts: AddEventListenerOptions = {
    capture: true,
    passive: true
  };

  // Held pointer keeps a slider drag "live" for its whole duration; discrete
  // events (keys, native input/change) stamp a fresh timestamp.
  window.addEventListener(
    "pointerdown",
    () => {
      _pointerDown = true;
      markGesture();
    },
    opts
  );
  window.addEventListener(
    "pointerup",
    () => {
      _pointerDown = false;
      markGesture();
    },
    opts
  );
  window.addEventListener(
    "pointercancel",
    () => {
      _pointerDown = false;
    },
    opts
  );
  window.addEventListener(
    "keydown",
    markGesture,
    opts
  );
  window.addEventListener(
    "input",
    markGesture,
    opts
  );
  window.addEventListener(
    "change",
    markGesture,
    opts
  );
  window.addEventListener(
    "wheel",
    markGesture,
    opts
  );
}

function hasRecentUserGesture(): boolean {
  return _pointerDown || nowMs() - _lastGestureAt <= USER_GESTURE_WINDOW_MS;
}

function ensureContext(): AudioContext | null {
  if ( typeof window === "undefined" ) {
    return null;
  }

  if ( _context ) {
    // The panel click always happens inside a user gesture, so resuming a
    // suspended context here satisfies autoplay policy.
    if ( _context.state === "suspended" ) {
      _context.resume().catch( () => {
        // Retried on the next click.
      } );
    }

    return _context;
  }

  const Ctx =
    window.AudioContext ??
    ( window as unknown as {
      webkitAudioContext?: typeof AudioContext;
    } ).webkitAudioContext;

  if ( !Ctx ) {
    return null;
  }

  _context = new Ctx();
  _masterGain = _context.createGain();
  _masterGain.gain.value = 1;
  _masterGain.connect( _context.destination );

  return _context;
}

// Small stable hash → pitch offset, so "slides.0.sketch.magnitude" always
// ticks at the same tone and neighbouring fields sound distinct.
function fieldPitchOffset( fieldPath: string ): number {
  let hash = 0;

  for ( let i = 0; i < fieldPath.length; i++ ) {
    hash = ( hash * 31 + fieldPath.charCodeAt( i ) ) | 0;
  }

  // Map to ±0.35 octaves.
  return ( ( ( hash % 1000 ) + 1000 ) % 1000 / 1000 - 0.5 ) * 0.7;
}

function playClicks(
  current: UiSoundSettings,
  baseRate: number,
  times: number
): void {
  const ctx = ensureContext();

  if ( !ctx || !_masterGain ) {
    return;
  }

  for ( let i = 0; i < times; i++ ) {
    const humanize =
      ( Math.random() * 2 - 1 ) * current.pitchVariation * 0.5;
    const rate =
      baseRate *
      Math.pow(
        2,
        humanize + current.repeatPitchStep * i
      );

    scheduleClick(
      ctx,
      _masterGain,
      ctx.currentTime + ( i * current.repeatIntervalMs ) / 1000,
      current.preset,
      {
        gain: current.volume,
        rate
      }
    );
  }
}

/**
 * A template option value changed in the panel. Throttled by `minGapMs`;
 * pitch derives from the field path when `pitchByField` is on.
 */
export function playValueChange( fieldPath?: string ): void {
  if ( _suppressDepth > 0 ) {
    return;
  }

  const current = getUiSoundSettings();

  if ( !current.enabled ) {
    return;
  }

  // Only genuine user edits click — programmatic writes (sketch sync on open,
  // mount-time normalization) reach here with no preceding gesture.
  if ( !hasRecentUserGesture() ) {
    return;
  }

  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  if ( now - _lastClickAt < current.minGapMs ) {
    return;
  }

  _lastClickAt = now;

  const fieldOffset =
    current.pitchByField && fieldPath ? fieldPitchOffset( fieldPath ) : 0;
  const baseRate = current.pitch * Math.pow(
    2,
    fieldOffset
  );

  playClicks(
    current,
    baseRate,
    current.repeatTimes
  );
}

/**
 * An action button (reset / randomize / save defaults / …) was pressed.
 * Slightly lower-pitched single click so it reads as "did something" rather
 * than "value ticked".
 */
export function playAction(): void {
  const current = getUiSoundSettings();

  if ( !current.enabled || !current.actionSounds ) {
    return;
  }

  playClicks(
    current,
    current.pitch * 0.8,
    1
  );
}

/** Preview the current settings from the settings popover. */
export function playPreview(): void {
  const current = getUiSoundSettings();

  playClicks(
    current,
    current.pitch,
    Math.max(
      1,
      current.repeatTimes
    )
  );
}
