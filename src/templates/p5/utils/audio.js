import {
  registerAudioBridge
} from "@/lib/audioBridge";

/**
 * Code-driven sound engine for sketches (raw Web Audio, no p5.sound).
 *
 * Sounds are synthesised on demand — an oscillator plus a gain envelope is
 * enough for the bips/ticks aesthetic — so sketches stay asset-free by
 * default. `registerSample()` / `loadSample()` are the seam for the future
 * audio-asset system: once a sample is registered under a name,
 * `trigger(name)` plays it instead of the synth fallback.
 *
 * Everything is lazy: no AudioContext is created until the first trigger,
 * so sketches that never make sound pay nothing. The context starts
 * suspended under autoplay policy; any pointer/key gesture resumes it, and
 * the recorder also calls `ensureRunning()` from its own start gesture.
 *
 * The master gain feeds both the speakers and a MediaStreamAudioDestination
 * exposed through the audio bridge, so realtime recordings capture exactly
 * what is heard, in sync, with no extra wiring in sketches.
 */

let _context = null;
let _masterGain = null;
let _recordingDestination = null;
let _recordingKeepAlive = null;
let _unlockAttached = false;

const _samples = new Map(); // name → AudioBuffer
const _samplePromises = new Map(); // url → Promise (dedupe concurrent loads)

const MIN_GAIN = 0.0001; // exponentialRamp target — can't reach true zero

function attachUnlockListeners() {
  if ( _unlockAttached || typeof window === "undefined" ) {
    return;
  }

  const unlock = () => {
    resume();
  };

  window.addEventListener(
    "pointerdown",
    unlock,
    {
      passive: true
    }
  );
  window.addEventListener(
    "keydown",
    unlock,
    {
      passive: true
    }
  );
  _unlockAttached = true;
}

async function resume() {
  if ( _context && _context.state === "suspended" ) {
    try {
      await _context.resume();
    } catch {
      // Will retry on the next gesture.
    }
  }
}

function ensureContext() {
  if ( _context ) {
    return _context;
  }

  const Ctx = window.AudioContext ?? window.webkitAudioContext;

  if ( !Ctx ) {
    return null;
  }

  _context = new Ctx();
  _masterGain = _context.createGain();
  _masterGain.gain.value = 0.8;
  _masterGain.connect( _context.destination );

  attachUnlockListeners();

  registerAudioBridge( {
    getRecordingStream: () => audio.getRecordingStream(),
    ensureRunning: resume
  } );

  return _context;
}

/**
 * One synthesised voice: oscillator → envelope gain → master.
 * Returns immediately; the voice frees itself when the envelope ends.
 */
function playVoice( {
  freq = 440,
  endFreq = null,
  type = "sine",
  duration = 0.15,
  attack = 0.002,
  gain = 0.5
} = {} ) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(
    Math.max(
      1,
      freq
    ),
    now
  );

  if ( endFreq && endFreq > 0 ) {
    osc.frequency.exponentialRampToValueAtTime(
      endFreq,
      now + duration
    );
  }

  envelope.gain.setValueAtTime(
    MIN_GAIN,
    now
  );
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(
      MIN_GAIN,
      gain
    ),
    now + attack
  );
  envelope.gain.exponentialRampToValueAtTime(
    MIN_GAIN,
    now + duration
  );

  osc.connect( envelope );
  envelope.connect( _masterGain );

  osc.start( now );
  osc.stop( now + duration + 0.05 );
  osc.onended = () => {
    osc.disconnect();
    envelope.disconnect();
  };
}

/** Short filtered-noise burst — typewriter ticks, UI clicks. */
function playTick( {
  duration = 0.03,
  freq = 3000,
  gain = 0.3
} = {} ) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const now = ctx.currentTime;
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
  filter.frequency.value = freq;
  filter.Q.value = 1;
  envelope.gain.value = gain;

  source.connect( filter );
  filter.connect( envelope );
  envelope.connect( _masterGain );

  source.start( now );
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
}

function playSample(
  buffer, {
    gain = 1,
    playbackRate = 1
  } = {}
) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const source = ctx.createBufferSource();
  const envelope = ctx.createGain();

  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  envelope.gain.value = gain;

  source.connect( envelope );
  envelope.connect( _masterGain );

  source.start( ctx.currentTime );
  source.onended = () => {
    source.disconnect();
    envelope.disconnect();
  };
}

const SYNTH_PRESETS = {
  beep: playVoice,
  bounce: ( params ) => playVoice( {
    type: "triangle",
    endFreq: ( params?.freq ?? 440 ) * 0.5,
    ...params
  } ),
  tick: playTick
};

const audio = {
  /** True once a context exists (i.e. something already made sound). */
  isActive: () => _context !== null,

  resume,

  setVolume: ( value ) => {
    if ( ensureContext() ) {
      _masterGain.gain.value = Math.max(
        0,
        Math.min(
          1,
          value
        )
      );
    }
  },

  /**
   * Fire a named sound. Registered samples win over synth presets, so an
   * uploaded "bounce" asset transparently replaces the coded one.
   */
  trigger: (
    name, params
  ) => {
    const sample = _samples.get( name );

    if ( sample ) {
      playSample(
        sample,
        params
      );

      return;
    }

    const preset = SYNTH_PRESETS[ name ];

    if ( preset ) {
      preset( params );
    }
  },

  beep: playVoice,
  tick: playTick,

  registerSample: (
    name, buffer
  ) => {
    _samples.set(
      name,
      buffer
    );
  },

  /** Fetch + decode an audio file and register it under `name`. */
  loadSample: async(
    name, url
  ) => {
    const ctx = ensureContext();

    if ( !ctx || !url ) {
      return null;
    }

    if ( !_samplePromises.has( url ) ) {
      _samplePromises.set(
        url,
        fetch( url )
          .then( ( response ) => response.arrayBuffer() )
          .then( ( bytes ) => ctx.decodeAudioData( bytes ) )
      );
    }

    try {
      const buffer = await _samplePromises.get( url );

      _samples.set(
        name,
        buffer
      );

      return buffer;
    } catch {
      _samplePromises.delete( url );

      return null;
    }
  },

  /**
   * Master output as a MediaStream for the realtime recorder.
   *
   * A *fresh* destination is built on every call (i.e. per recording):
   * a reused node can carry samples buffered before the recording
   * started, which MediaRecorder muxes as a constant A/V offset.
   *
   * A silent constant source is also kept running into the destination
   * so the track delivers data continuously from t=0 — without an active
   * source the track can go idle between sparse bips, and the muxer
   * compacts those gaps, shifting every later sound.
   */
  getRecordingStream: () => {
    const ctx = ensureContext();

    if ( !ctx ) {
      return null;
    }

    if ( _recordingDestination ) {
      try {
        _masterGain.disconnect( _recordingDestination );
        _recordingKeepAlive?.stop();
        _recordingKeepAlive?.disconnect();
      } catch {
        // Stale graph teardown must never block a new recording.
      }
    }

    _recordingDestination = ctx.createMediaStreamDestination();
    _masterGain.connect( _recordingDestination );

    _recordingKeepAlive = ctx.createConstantSource();
    _recordingKeepAlive.offset.value = 0;
    _recordingKeepAlive.connect( _recordingDestination );
    _recordingKeepAlive.start();

    return _recordingDestination.stream;
  }
};

export default audio;
