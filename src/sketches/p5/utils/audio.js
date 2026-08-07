import {
  registerAudioBridge
} from "@/lib/audioBridge";
import {
  scheduleClick
} from "@/lib/clickSynth";
import time from "./time.js";
import {
  isAudioPath
} from "./audioPaths.js";

/**
 * Code-driven sound engine for sketches (raw Web Audio, no p5.sound).
 *
 * Sounds are synthesised on demand — an oscillator plus a gain envelope is
 * enough for the bips/ticks aesthetic — so sketches stay asset-free by
 * default. `registerSample()` / `loadSample()` carry the audio-asset system
 * (`audioAssets.js`): an uploaded sound is decoded once and registered under
 * its asset path, and `trigger(path)` then plays it instead of the synth —
 * through the very same live / realtime / offline paths as a synth voice.
 *
 * Everything is lazy: no AudioContext is created until the first trigger,
 * so sketches that never make sound pay nothing. The context starts
 * suspended under autoplay policy; any pointer/key gesture resumes it, and
 * the recorder also calls `ensureRunning()` from its own start gesture.
 *
 * Two recording paths:
 *   - Realtime: the master gain feeds a MediaStreamAudioDestination that
 *     MediaRecorder mixes into the captured video.
 *   - Deterministic (async-loop / server): `beginCapture()` swaps live
 *     playback for an event log; `renderOffline()` then replays the log
 *     through an OfflineAudioContext at sample-accurate timestamps, so
 *     the muxed audio matches the rendered frames exactly.
 */

let _context = null;
let _masterGain = null;
let _recordingDestination = null;
let _recordingKeepAlive = null;
let _unlockAttached = false;

const _samples = new Map(); // name → AudioBuffer
const _samplePromises = new Map(); // url → Promise (dedupe concurrent loads)

let _captureMode = false;
let _capturedEvents = []; // { t, name, params }

const MIN_GAIN = 0.0001; // exponentialRamp target — can't reach true zero

// Names already reported as "triggered but nothing decoded behind it", so a
// per-frame trigger warns once instead of flooding the console.
const _warnedMissing = new Set();

function warnMissingSample( name ) {
  if ( _warnedMissing.has( name ) ) {
    return;
  }

  _warnedMissing.add( name );
  console.warn( `[audio] "${ name }" was triggered but no sample is registered under that path — staying silent. The upload may still be decoding, or it failed to load.` );
}

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

  return _context;
}

/* ------------------------------------------------------------------ */
/*  Voice routines (context-agnostic so the offline render uses them)  */
/* ------------------------------------------------------------------ */

function playVoiceOn(
  ctx, destination, startTime, {
    freq = 440,
    endFreq = null,
    type = "sine",
    duration = 0.15,
    attack = 0.002,
    gain = 0.5
  } = {}
) {
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
      endFreq,
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

  return {
    osc,
    envelope
  };
}

function playTickOn(
  ctx, destination, startTime, {
    duration = 0.03,
    freq = 3000,
    gain = 0.3
  } = {}
) {
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
  envelope.connect( destination );

  source.start( startTime );

  return {
    source,
    filter,
    envelope
  };
}

// Air-displacement whoosh: a noise burst through a bandpass whose centre
// frequency rises then falls across the sound (the classic fly-by sweep),
// with an optional stereo pan so the pass can be placed left/right. The
// bandpass strips most of the noise energy, so a fixed makeup gain keeps
// `gain` on the same perceived scale as the oscillator presets.
const WHOOSH_MAKEUP = 2.2;

function playWhooshOn(
  ctx, destination, startTime, {
    duration = 0.45,
    freq = 550,
    sweep = 2.4,
    q = 1.4,
    gain = 0.5,
    pan = 0
  } = {}
) {
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
    data[ i ] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const envelope = ctx.createGain();

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.Q.value = q;

  // Rise into the pass, fall away after it.
  const peakAt = startTime + duration * 0.35;

  filter.frequency.setValueAtTime(
    Math.max(
      1,
      freq * 0.55
    ),
    startTime
  );
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(
      1,
      freq * sweep
    ),
    peakAt
  );
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(
      1,
      freq * 0.45
    ),
    startTime + duration
  );

  envelope.gain.setValueAtTime(
    MIN_GAIN,
    startTime
  );
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(
      MIN_GAIN,
      gain * WHOOSH_MAKEUP
    ),
    peakAt
  );
  envelope.gain.exponentialRampToValueAtTime(
    MIN_GAIN,
    startTime + duration
  );

  source.connect( filter );
  filter.connect( envelope );

  let panner = null;

  if ( pan && typeof ctx.createStereoPanner === "function" ) {
    panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(
      -1,
      Math.min(
        1,
        pan
      )
    );
    envelope.connect( panner );
    panner.connect( destination );
  } else {
    envelope.connect( destination );
  }

  source.start( startTime );
  source.stop( startTime + duration + 0.05 );

  return {
    source,
    filter,
    envelope,
    panner
  };
}

// One grain of a continuous drone bed: band-limited noise (breath) over a soft
// sine sub an octave below, with a trapezoid envelope so grains fired at a
// regular spacing crossfade into a steady, seamless hum. Continuous sounds are
// built from overlapping grains rather than an endless node so the capture
// pipeline (which replays logged one-shot events offline) reproduces them.
const DRONE_MAKEUP = 2.0;

function playDroneOn(
  ctx, destination, startTime, {
    duration = 0.6,
    freq = 175,
    q = 0.9,
    gain = 0.4,
    sub = 0.5,
    pan = 0
  } = {}
) {
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
    data[ i ] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  const envelope = ctx.createGain();

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = Math.max(
    1,
    freq
  );
  filter.Q.value = q;
  noiseGain.gain.value = DRONE_MAKEUP;

  osc.type = "sine";
  osc.frequency.value = Math.max(
    1,
    freq * 0.5
  );
  oscGain.gain.value = sub;

  // Trapezoid: linear ramps overlap-add to a near-constant level, where
  // exponential ones would comb.
  const rise = duration * 0.3;

  envelope.gain.setValueAtTime(
    0,
    startTime
  );
  envelope.gain.linearRampToValueAtTime(
    gain,
    startTime + rise
  );
  envelope.gain.setValueAtTime(
    gain,
    startTime + duration - rise
  );
  envelope.gain.linearRampToValueAtTime(
    0,
    startTime + duration
  );

  source.connect( filter );
  filter.connect( noiseGain );
  noiseGain.connect( envelope );
  osc.connect( oscGain );
  oscGain.connect( envelope );

  let panner = null;

  if ( pan && typeof ctx.createStereoPanner === "function" ) {
    panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(
      -1,
      Math.min(
        1,
        pan
      )
    );
    envelope.connect( panner );
    panner.connect( destination );
  } else {
    envelope.connect( destination );
  }

  source.start( startTime );
  source.stop( startTime + duration + 0.05 );
  osc.start( startTime );
  osc.stop( startTime + duration + 0.05 );

  return {
    source,
    filter,
    noiseGain,
    osc,
    oscGain,
    envelope,
    panner
  };
}

function playSampleOn(
  ctx, destination, startTime, buffer, {
    gain = 1,
    playbackRate = 1
  } = {}
) {
  const source = ctx.createBufferSource();
  const envelope = ctx.createGain();

  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  envelope.gain.value = gain;

  source.connect( envelope );
  envelope.connect( destination );

  source.start( startTime );

  return {
    source,
    envelope
  };
}

/**
 * Single dispatch shared by live playback and offline rendering, so a
 * named sound produces identical audio in both paths. Sample registry
 * wins over synth presets (the audio-asset hook for later).
 */
function scheduleOn(
  ctx, destination, startTime, name, params
) {
  const sample = _samples.get( name );

  if ( sample ) {
    playSampleOn(
      ctx,
      destination,
      startTime,
      sample,
      params
    );

    return;
  }

  // An asset path with no decoded sample behind it (upload removed, decode
  // failed): stay silent. Falling through to the default voice would replace
  // a missing sound with a stray beep in the rendered file.
  if ( isAudioPath( name ) ) {
    return;
  }

  switch ( name ) {
    // UI-style click presets (specs overlay, value-change feedback). The
    // concrete voice is picked by `params.preset` inside the shared synth so
    // live playback and offline capture render the exact same sound.
    case "click":
      scheduleClick(
        ctx,
        destination,
        startTime,
        params?.preset ?? "click",
        params
      );
      break;
    case "tick":
      playTickOn(
        ctx,
        destination,
        startTime,
        params
      );
      break;
    case "whoosh":
      playWhooshOn(
        ctx,
        destination,
        startTime,
        params
      );
      break;
    case "drone":
      playDroneOn(
        ctx,
        destination,
        startTime,
        params
      );
      break;
    case "bounce":
      playVoiceOn(
        ctx,
        destination,
        startTime,
        {
          type: "triangle",
          endFreq: ( params?.freq ?? 440 ) * 0.5,
          ...params
        }
      );
      break;
    case "beep":
    default:
      playVoiceOn(
        ctx,
        destination,
        startTime,
        params
      );
      break;
  }
}

/* ------------------------------------------------------------------ */
/*  Live playback wrappers                                            */
/* ------------------------------------------------------------------ */

function playVoiceLive( params ) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const handles = playVoiceOn(
    ctx,
    _masterGain,
    ctx.currentTime,
    params
  );

  handles.osc.onended = () => {
    handles.osc.disconnect();
    handles.envelope.disconnect();
  };
}

function playTickLive( params ) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const handles = playTickOn(
    ctx,
    _masterGain,
    ctx.currentTime,
    params
  );

  handles.source.onended = () => {
    handles.source.disconnect();
    handles.filter.disconnect();
    handles.envelope.disconnect();
  };
}

function playWhooshLive( params ) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const handles = playWhooshOn(
    ctx,
    _masterGain,
    ctx.currentTime,
    params
  );

  handles.source.onended = () => {
    handles.source.disconnect();
    handles.filter.disconnect();
    handles.envelope.disconnect();
    handles.panner?.disconnect();
  };
}

function playDroneLive( params ) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const handles = playDroneOn(
    ctx,
    _masterGain,
    ctx.currentTime,
    params
  );

  handles.source.onended = () => {
    handles.source.disconnect();
    handles.filter.disconnect();
    handles.noiseGain.disconnect();
    handles.osc.disconnect();
    handles.oscGain.disconnect();
    handles.envelope.disconnect();
    handles.panner?.disconnect();
  };
}

function playClickLive( params ) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  // The shared synth cleans its own nodes up via onended.
  scheduleClick(
    ctx,
    _masterGain,
    ctx.currentTime,
    params?.preset ?? "click",
    params
  );
}

function playSampleLive(
  buffer, params
) {
  const ctx = ensureContext();

  if ( !ctx ) {
    return;
  }

  const handles = playSampleOn(
    ctx,
    _masterGain,
    ctx.currentTime,
    buffer,
    params
  );

  handles.source.onended = () => {
    handles.source.disconnect();
    handles.envelope.disconnect();
  };
}

/**
 * Serialise an AudioBuffer to a base64-encoded 16-bit PCM WAV. Used by the
 * server pipeline: Playwright can only move strings/JSON out of the page,
 * and FFmpeg muxes a WAV without re-encoding the already-finished video.
 */
function audioBufferToWavBase64( buffer ) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer( 44 + dataSize );
  const view = new DataView( arrayBuffer );

  const writeString = (
    offset, value
  ) => {
    for ( let i = 0; i < value.length; i++ ) {
      view.setUint8(
        offset + i,
        value.charCodeAt( i )
      );
    }
  };

  writeString(
    0,
    "RIFF"
  );
  view.setUint32(
    4,
    36 + dataSize,
    true
  );
  writeString(
    8,
    "WAVE"
  );
  writeString(
    12,
    "fmt "
  );
  view.setUint32(
    16,
    16,
    true
  );
  view.setUint16(
    20,
    1, // PCM
    true
  );
  view.setUint16(
    22,
    numChannels,
    true
  );
  view.setUint32(
    24,
    sampleRate,
    true
  );
  view.setUint32(
    28,
    sampleRate * numChannels * bytesPerSample,
    true
  );
  view.setUint16(
    32,
    numChannels * bytesPerSample,
    true
  );
  view.setUint16(
    34,
    16,
    true
  );
  writeString(
    36,
    "data"
  );
  view.setUint32(
    40,
    dataSize,
    true
  );

  let offset = 44;

  for ( let i = 0; i < numFrames; i++ ) {
    for ( let channel = 0; channel < numChannels; channel++ ) {
      const sample = Math.max(
        -1,
        Math.min(
          1,
          buffer.getChannelData( channel )[ i ]
        )
      );

      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  const bytes = new Uint8Array( arrayBuffer );
  const CHUNK = 0x8000;
  let binary = "";

  for ( let i = 0; i < bytes.length; i += CHUNK ) {
    binary += String.fromCharCode( ...bytes.subarray(
      i,
      i + CHUNK
    ) );
  }

  return btoa( binary );
}

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
   * Fire a named sound. In capture mode the call is logged instead of
   * played, so the deterministic recorder can render the audio offline
   * after the frame loop.
   */
  trigger: (
    name, params
  ) => {
    if ( _captureMode ) {
      _capturedEvents.push( {
        t: time.seconds(),
        name,
        params: params ? {
          ...params
        } : undefined
      } );

      return;
    }

    const sample = _samples.get( name );

    if ( sample ) {
      // The context can be suspended long after it was created — the autoplay
      // policy at startup, or the browser parking a backgrounded tab. Nudge it
      // back, or every sound from here on is silently discarded.
      if ( _context?.state === "suspended" ) {
        resume();
      }

      playSampleLive(
        sample,
        params
      );

      return;
    }

    // See `scheduleOn`: a missing asset is silence, never a fallback beep.
    // Say so once — a sound that never arrives is otherwise indistinguishable
    // from one that plays too quietly to notice.
    if ( isAudioPath( name ) ) {
      warnMissingSample( name );

      return;
    }

    switch ( name ) {
      case "click":
        playClickLive( params );
        break;
      case "tick":
        playTickLive( params );
        break;
      case "whoosh":
        playWhooshLive( params );
        break;
      case "drone":
        playDroneLive( params );
        break;
      case "bounce":
        playVoiceLive( {
          type: "triangle",
          endFreq: ( params?.freq ?? 440 ) * 0.5,
          ...params
        } );
        break;
      case "beep":
      default:
        playVoiceLive( params );
        break;
    }
  },

  beep: playVoiceLive,
  tick: playTickLive,

  /**
   * Whether a sample is registered under `name` RIGHT NOW. The engine's
   * registry is the only authority on "can this be played" — a caller that
   * tracks its own loading state can drift from it (a module re-evaluated by
   * Fast Refresh, a sketch reset), and a stale "ready" flag turns into
   * silence.
   */
  hasSample: ( name ) => _samples.has( name ),

  registerSample: (
    name, buffer
  ) => {
    _warnedMissing.delete( name );
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
          .then( ( response ) => {
            // A 404 hands back an HTML body, which decodeAudioData rejects with
            // a message that says nothing about the real problem. Name it here.
            if ( !response.ok ) {
              throw new Error( `HTTP ${ response.status } fetching ${ url }` );
            }

            return response.arrayBuffer();
          } )
          .then( ( bytes ) => ctx.decodeAudioData( bytes ) )
      );
    }

    try {
      const buffer = await _samplePromises.get( url );

      _warnedMissing.delete( name );
      _samples.set(
        name,
        buffer
      );

      return buffer;
    } catch( error ) {
      _samplePromises.delete( url );
      console.warn(
        `[audio] Could not load the sound "${ name }" — it will stay silent.`,
        error
      );

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
  },

  /* ---------------------------------------------------------------- */
  /*  Deterministic capture                                           */
  /* ---------------------------------------------------------------- */

  beginCapture: () => {
    _captureMode = true;
    _capturedEvents = [];
  },

  endCapture: () => {
    _captureMode = false;
    const events = _capturedEvents;

    _capturedEvents = [];

    return events;
  },

  /**
   * Replay the logged events into an OfflineAudioContext and return the
   * rendered AudioBuffer. Events past `duration` are dropped so a stray
   * tail-end bip never extends the muxed audio beyond the video.
   */
  renderOffline: async( {
    duration,
    sampleRate = 48000,
    numberOfChannels = 1,
    events = _capturedEvents
  } = {} ) => {
    if ( !duration || duration <= 0 ) {
      throw new Error( "audio.renderOffline: duration must be a positive number." );
    }

    const length = Math.ceil( duration * sampleRate );
    const offlineCtx = new OfflineAudioContext( {
      numberOfChannels,
      sampleRate,
      length
    } );

    const masterGain = offlineCtx.createGain();

    masterGain.gain.value = 0.8;
    masterGain.connect( offlineCtx.destination );

    for ( const event of events ) {
      if ( event.t < 0 || event.t >= duration ) {
        continue;
      }

      scheduleOn(
        offlineCtx,
        masterGain,
        event.t,
        event.name,
        event.params
      );
    }

    return offlineCtx.startRendering();
  },

  /**
   * Server-pipeline variant of `renderOffline`: returns base64 WAV, or
   * `null` when no event was captured so the server skips muxing.
   */
  renderOfflineWav: async( opts = {} ) => {
    if ( _capturedEvents.length === 0 ) {
      return null;
    }

    const buffer = await audio.renderOffline( opts );

    return audioBufferToWavBase64( buffer );
  }
};

// Register at module scope, not on first sound: the headless pipeline
// never plays live audio (capture mode logs events without a context),
// yet it still needs `window.__sketchAudio` to exist to collect + render
// them. Video-only sketches never import this module, so they register
// no bridge and the recording paths stay video-only.
if ( typeof window !== "undefined" ) {
  registerAudioBridge( {
    getRecordingStream: () => audio.getRecordingStream(),
    ensureRunning: resume,
    beginCapture: () => audio.beginCapture(),
    endCapture: () => audio.endCapture(),
    renderOffline: ( opts ) => audio.renderOffline( opts ),
    renderOfflineWav: ( opts ) => audio.renderOfflineWav( opts )
  } );
}

export default audio;
