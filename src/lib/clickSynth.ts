/**
 * Shared "pleasing click" synthesiser.
 *
 * One preset table, two consumers:
 *   - the sketch audio engine (`@/p5/utils/audio.js`) exposes them through
 *     `audio.trigger("click", { preset, ... })`, so a specs overlay click is
 *     heard live AND rendered sample-accurately into deterministic captures;
 *   - the editor UI sound module (`@/lib/uiSound.ts`) plays them on template
 *     option changes through its own AudioContext, so panel feedback can
 *     never bleed into a recording.
 *
 * Every voice is context-agnostic — it only ever touches the `ctx` and
 * `destination` it is handed — which is what lets the same code run against a
 * live AudioContext and an OfflineAudioContext.
 */

export const CLICK_PRESET_NAMES = [
  "click",
  "tick",
  "blip",
  "pop",
  "beep",
  "wood",
  "typewriter"
] as const;

export type ClickPresetName = ( typeof CLICK_PRESET_NAMES )[ number ];

export interface ClickParams {
  /** Peak gain of the click, 0..1. */
  gain?: number;
  /**
   * Pitch multiplier applied to every frequency of the preset (1 = as
   * designed, 2 = one octave up, 0.5 = one octave down).
   */
  rate?: number;
}

export function isClickPreset( name: unknown ): name is ClickPresetName {
  return (
    typeof name === "string" &&
    ( CLICK_PRESET_NAMES as readonly string[] ).includes( name )
  );
}

// exponentialRamp cannot reach true zero.
const MIN_GAIN = 0.0001;

type AnyAudioContext = BaseAudioContext;

/* ------------------------------------------------------------------ */
/*  Primitive voices                                                   */
/* ------------------------------------------------------------------ */

interface ToneSpec {
  type?: OscillatorType;
  freq: number;
  endFreq?: number;
  duration?: number;
  attack?: number;
  gain?: number;
  delay?: number;
}

function tone(
  ctx: AnyAudioContext,
  destination: AudioNode,
  when: number,
  {
    type = "sine",
    freq,
    endFreq,
    duration = 0.05,
    attack = 0.001,
    gain = 0.5,
    delay = 0
  }: ToneSpec
) {
  const startTime = when + delay;
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(
    Math.max(
      1,
      freq
    ),
    startTime
  );

  if ( endFreq && endFreq > 0 ) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(
        1,
        endFreq
      ),
      startTime + duration
    );
  }

  envelope.gain.setValueAtTime(
    MIN_GAIN,
    startTime
  );
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(
      MIN_GAIN,
      gain
    ),
    startTime + attack
  );
  envelope.gain.exponentialRampToValueAtTime(
    MIN_GAIN,
    startTime + duration
  );

  osc.connect( envelope );
  envelope.connect( destination );

  osc.start( startTime );
  osc.stop( startTime + duration + 0.05 );

  osc.onended = () => {
    osc.disconnect();
    envelope.disconnect();
  };
}

interface NoiseSpec {
  freq: number;
  q?: number;
  duration?: number;
  gain?: number;
  delay?: number;
}

function noiseHit(
  ctx: AnyAudioContext,
  destination: AudioNode,
  when: number,
  {
    freq,
    q = 1,
    duration = 0.03,
    gain = 0.3,
    delay = 0
  }: NoiseSpec
) {
  const startTime = when + delay;
  const frameCount = Math.max(
    1,
    Math.floor( ctx.sampleRate * duration )
  );
  const buffer = ctx.createBuffer(
    1,
    frameCount,
    ctx.sampleRate
  );
  const data = buffer.getChannelData( 0 );

  for ( let i = 0; i < frameCount; i++ ) {
    data[ i ] = ( Math.random() * 2 - 1 ) * ( 1 - i / frameCount );
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const envelope = ctx.createGain();

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = Math.max(
    1,
    freq
  );
  filter.Q.value = q;
  envelope.gain.value = gain;

  source.connect( filter );
  filter.connect( envelope );
  envelope.connect( destination );

  source.start( startTime );

  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
}

/* ------------------------------------------------------------------ */
/*  Presets                                                            */
/* ------------------------------------------------------------------ */

type PresetVoice = (
  ctx: AnyAudioContext,
  destination: AudioNode,
  when: number,
  gain: number,
  rate: number
) => void;

// Each preset is a tiny "recipe" over the two primitives above. Frequencies
// are the designed pitch; `rate` transposes the whole recipe.
const PRESETS: Record<ClickPresetName, PresetVoice> = {
  // Soft camera-shutter tick: filtered noise snap plus a faint sine body.
  click: (
    ctx, destination, when, gain, rate
  ) => {
    noiseHit(
      ctx,
      destination,
      when,
      {
        freq: 2400 * rate,
        q: 3,
        duration: 0.025,
        gain
      }
    );
    tone(
      ctx,
      destination,
      when,
      {
        freq: 1800 * rate,
        duration: 0.02,
        gain: gain * 0.35
      }
    );
  },

  // Bright, dry metronome tick (pure filtered noise).
  tick: (
    ctx, destination, when, gain, rate
  ) => {
    noiseHit(
      ctx,
      destination,
      when,
      {
        freq: 3200 * rate,
        q: 1.5,
        duration: 0.03,
        gain
      }
    );
  },

  // Short rounded triangle blip — friendly UI "bip".
  blip: (
    ctx, destination, when, gain, rate
  ) => {
    tone(
      ctx,
      destination,
      when,
      {
        type: "triangle",
        freq: 1300 * rate,
        duration: 0.05,
        attack: 0.002,
        gain
      }
    );
  },

  // Bubble pop: fast downward pitch sweep.
  pop: (
    ctx, destination, when, gain, rate
  ) => {
    tone(
      ctx,
      destination,
      when,
      {
        freq: 520 * rate,
        endFreq: 160 * rate,
        duration: 0.09,
        attack: 0.002,
        gain
      }
    );
  },

  // Plain sine beep — longest of the set, reads as a confirmation.
  beep: (
    ctx, destination, when, gain, rate
  ) => {
    tone(
      ctx,
      destination,
      when,
      {
        freq: 880 * rate,
        duration: 0.12,
        attack: 0.004,
        gain
      }
    );
  },

  // Woodblock: resonant low noise knock over a short thump.
  wood: (
    ctx, destination, when, gain, rate
  ) => {
    noiseHit(
      ctx,
      destination,
      when,
      {
        freq: 950 * rate,
        q: 8,
        duration: 0.06,
        gain
      }
    );
    tone(
      ctx,
      destination,
      when,
      {
        freq: 220 * rate,
        endFreq: 180 * rate,
        duration: 0.05,
        gain: gain * 0.5
      }
    );
  },

  // Two-part mechanical key strike: hammer then rebound.
  typewriter: (
    ctx, destination, when, gain, rate
  ) => {
    noiseHit(
      ctx,
      destination,
      when,
      {
        freq: 2000 * rate,
        q: 2,
        duration: 0.02,
        gain
      }
    );
    noiseHit(
      ctx,
      destination,
      when,
      {
        freq: 1400 * rate,
        q: 2,
        duration: 0.03,
        gain: gain * 0.6,
        delay: 0.03
      }
    );
  }
};

/**
 * Schedule one click of `preset` at `when` (in the context's time base).
 * Works against a live AudioContext (when = ctx.currentTime + offset) and an
 * OfflineAudioContext (when = event timestamp) alike.
 */
export function scheduleClick(
  ctx: AnyAudioContext,
  destination: AudioNode,
  when: number,
  preset: string,
  {
    gain = 0.5,
    rate = 1
  }: ClickParams = {}
): void {
  const voice = PRESETS[ isClickPreset( preset ) ? preset : "click" ];

  voice(
    ctx,
    destination,
    when,
    Math.max(
      0,
      Math.min(
        1,
        gain
      )
    ),
    Math.max(
      0.05,
      rate
    )
  );
}
