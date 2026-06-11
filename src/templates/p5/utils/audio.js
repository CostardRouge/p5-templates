import {
  registerAudioBridge
} from "@/lib/audioBridge";
import time from "./time.js";

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
    ensureRunning: resume,
    beginCapture: () => audio.beginCapture(),
    endCapture: () => audio.endCapture(),
    renderOffline: ( opts ) => audio.renderOffline( opts )
  } );

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

  switch ( name ) {
    case "tick":
      playTickOn(
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
      playSampleLive(
        sample,
        params
      );

      return;
    }

    switch ( name ) {
      case "tick":
        playTickLive( params );
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
  }
};

export default audio;
