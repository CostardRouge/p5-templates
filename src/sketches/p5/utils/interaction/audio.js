// Audio DSP helpers — kicks, onsets, pitch, named bands, spectral features.
// All helpers operate on the raw Uint8Array from AnalyserNode without
// allocations on the hot path. Stateful detectors receive a plain state
// object owned by the caller; helpers mutate it in place.

// ── Named bands ────────────────────────────────────────────────────────────

export const DEFAULT_BANDS = {
  subBass: [
    20,
    60
  ],
  bass: [
    60,
    250
  ],
  lowMid: [
    250,
    500
  ],
  mid: [
    500,
    2000
  ],
  highMid: [
    2000,
    4000
  ],
  presence: [
    4000,
    6000
  ],
  brilliance: [
    6000,
    20000
  ]
};

function _binForHz(
  hz, sampleRate, fftSize
) {
  return Math.max(
    0,
    Math.min(
      fftSize / 2 - 1,
      Math.round( hz * fftSize / sampleRate )
    )
  );
}

export function getBandEnergy(
  freqData, sampleRate, fftSize, fLow, fHigh
) {
  const a = _binForHz(
    fLow,
    sampleRate,
    fftSize
  );
  const b = _binForHz(
    fHigh,
    sampleRate,
    fftSize
  );

  if ( b <= a ) {
    return 0;
  }

  let sum = 0;

  for ( let i = a; i < b; i++ ) {
    sum += freqData[ i ];
  }

  return sum / ( ( b - a ) * 255 );
}

export function getNamedBands(
  freqData, sampleRate, fftSize, bands = DEFAULT_BANDS
) {
  const out = {};

  for ( const name of Object.keys( bands ) ) {
    const [
      lo,
      hi
    ] = bands[ name ];

    out[ name ] = getBandEnergy(
      freqData,
      sampleRate,
      fftSize,
      lo,
      hi
    );
  }

  return out;
}

// ── Kick detector (low-band energy vs running average) ─────────────────────

const KICK_DEFAULTS = {
  fLow: 40,
  fHigh: 150,
  sensitivity: 1.4,
  refractoryMs: 100,
  decayTau: 200
};

function _now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function detectKick(
  state, freqData, sampleRate, fftSize, opts = {}
) {
  const o = {
    ...KICK_DEFAULTS,
    ...opts
  };
  const now = _now();

  if ( !state.initialized ) {
    state.avg = 0;
    state.lastHit = -Infinity;
    state.strength = 0;
    state.initialized = true;
  }

  const energy = getBandEnergy(
    freqData,
    sampleRate,
    fftSize,
    o.fLow,
    o.fHigh
  );
  const alpha = 0.02;

  state.avg = state.avg * ( 1 - alpha ) + energy * alpha;

  let hit = false;

  if ( energy > state.avg * o.sensitivity && energy > 0.05 && now - state.lastHit > o.refractoryMs ) {
    hit = true;
    state.lastHit = now;
    state.strength = Math.min(
      1,
      energy
    );
  }

  const age = now - state.lastHit;
  const decay = Math.exp( -age / o.decayTau );

  return {
    hit,
    strength: state.strength * decay,
    age,
    energy
  };
}

// ── Onset detector (spectral flux + peak picking) ──────────────────────────

const ONSET_DEFAULTS = {
  sensitivity: 1.5,
  refractoryMs: 60,
  decayTau: 150,
  minFlux: 0.005
};

export function detectOnset(
  state, freqData, opts = {}
) {
  const o = {
    ...ONSET_DEFAULTS,
    ...opts
  };
  const now = _now();

  if ( !state.initialized ) {
    state.prev = new Uint8Array( freqData.length );
    state.fluxAvg = 0;
    state.lastHit = -Infinity;
    state.strength = 0;
    state.initialized = true;
  }

  let flux = 0;

  for ( let i = 0; i < freqData.length; i++ ) {
    const d = freqData[ i ] - state.prev[ i ];

    if ( d > 0 ) {
      flux += d;
    }

    state.prev[ i ] = freqData[ i ];
  }

  flux /= freqData.length * 255;

  const alpha = 0.04;

  state.fluxAvg = state.fluxAvg * ( 1 - alpha ) + flux * alpha;

  let hit = false;

  if ( flux > state.fluxAvg * o.sensitivity && flux > o.minFlux && now - state.lastHit > o.refractoryMs ) {
    hit = true;
    state.lastHit = now;
    state.strength = Math.min(
      1,
      flux * 5
    );
  }

  const age = now - state.lastHit;
  const decay = Math.exp( -age / o.decayTau );

  return {
    hit,
    strength: state.strength * decay,
    age,
    flux
  };
}

// ── Pitch detector (YIN-lite, time domain) ─────────────────────────────────

const PITCH_DEFAULTS = {
  minHz: 60,
  maxHz: 1500,
  everyNFrames: 2,
  threshold: 0.15
};

function _hzToMidi( hz ) {
  if ( hz <= 0 ) {
    return 0;
  }

  return 69 + 12 * Math.log2( hz / 440 );
}

export function detectPitch(
  state, timeData, sampleRate, opts = {}
) {
  const o = {
    ...PITCH_DEFAULTS,
    ...opts
  };

  if ( !state.initialized ) {
    state.frame = 0;
    state.hz = 0;
    state.midi = 0;
    state.confidence = 0;
    state.buf = new Float32Array( timeData.length );
    state.yin = new Float32Array( ( timeData.length >> 1 ) + 1 );
    state.initialized = true;
  }

  state.frame++;

  if ( state.frame % o.everyNFrames !== 0 ) {
    return {
      hz: state.hz,
      midi: state.midi,
      confidence: state.confidence
    };
  }

  const N = timeData.length;
  const buf = state.buf;

  for ( let i = 0; i < N; i++ ) {
    buf[ i ] = ( timeData[ i ] - 128 ) / 128;
  }

  const half = N >> 1;
  const tauMin = Math.max(
    2,
    Math.floor( sampleRate / o.maxHz )
  );
  const tauMax = Math.min(
    half - 1,
    Math.floor( sampleRate / o.minHz )
  );
  const yin = state.yin;

  yin[ 0 ] = 1;

  for ( let tau = 1; tau <= tauMax; tau++ ) {
    let s = 0;

    for ( let i = 0; i < half; i++ ) {
      const diff = buf[ i ] - buf[ i + tau ];

      s += diff * diff;
    }

    yin[ tau ] = s;
  }

  let running = 0;

  for ( let tau = 1; tau <= tauMax; tau++ ) {
    running += yin[ tau ];
    yin[ tau ] = tau >= tauMin && running > 0 ? yin[ tau ] * tau / running : 1;
  }

  let tauEst = -1;

  for ( let tau = tauMin; tau < tauMax; tau++ ) {
    if ( yin[ tau ] < o.threshold ) {
      while ( tau + 1 < tauMax && yin[ tau + 1 ] < yin[ tau ] ) {
        tau++;
      }

      tauEst = tau;
      break;
    }
  }

  if ( tauEst < 0 ) {
    state.confidence *= 0.8;

    return {
      hz: state.hz,
      midi: state.midi,
      confidence: state.confidence
    };
  }

  let betterTau = tauEst;
  const x0 = tauEst - 1;
  const x2 = tauEst + 1;

  if ( x0 >= tauMin && x2 <= tauMax ) {
    const s0 = yin[ x0 ];
    const s1 = yin[ tauEst ];
    const s2 = yin[ x2 ];
    const denom = 2 * ( 2 * s1 - s2 - s0 );

    if ( denom !== 0 ) {
      betterTau = tauEst + ( s2 - s0 ) / denom;
    }
  }

  state.hz = sampleRate / betterTau;
  state.midi = _hzToMidi( state.hz );
  state.confidence = Math.max(
    0,
    1 - yin[ tauEst ]
  );

  return {
    hz: state.hz,
    midi: state.midi,
    confidence: state.confidence
  };
}

// ── Voice activity detection ───────────────────────────────────────────────

const VOICE_DEFAULTS = {
  fLow: 85,
  fHigh: 1100,
  energyThreshold: 0.04,
  // Voiced fundamentals run as low as ~0.003 ZCR for 80 Hz speakers; fricatives
  // (unvoiced) sit well above 0.35. Wide bracket = recall over precision.
  zcrLow: 0.003,
  zcrHigh: 0.35
};

function _zeroCrossingRate( timeData ) {
  let zc = 0;

  for ( let i = 1; i < timeData.length; i++ ) {
    if ( ( timeData[ i - 1 ] < 128 ) !== ( timeData[ i ] < 128 ) ) {
      zc++;
    }
  }

  return zc / ( timeData.length - 1 );
}

export function detectVoice(
  state, freqData, timeData, sampleRate, fftSize, opts = {}
) {
  const o = {
    ...VOICE_DEFAULTS,
    ...opts
  };

  if ( !state.initialized ) {
    state.active = false;
    state.confidence = 0;
    state.initialized = true;
  }

  const voiceBand = getBandEnergy(
    freqData,
    sampleRate,
    fftSize,
    o.fLow,
    o.fHigh
  );
  const zcr = _zeroCrossingRate( timeData );
  const energyOk = voiceBand > o.energyThreshold;
  const zcrOk = zcr > o.zcrLow && zcr < o.zcrHigh;
  const score = energyOk && zcrOk ? Math.min(
    1,
    voiceBand * 3
  ) : 0;

  state.confidence = state.confidence * 0.7 + score * 0.3;
  state.active = state.confidence > 0.2;

  return {
    active: state.active,
    confidence: state.confidence,
    zcr,
    voiceBand
  };
}

// ── Spectral features ──────────────────────────────────────────────────────

export function spectralFeatures(
  state, freqData, sampleRate, fftSize
) {
  if ( !state.initialized ) {
    state.prev = new Uint8Array( freqData.length );
    state.initialized = true;
  }

  const N = freqData.length;
  let totalMag = 0;
  let weightedFreq = 0;
  let logSum = 0;
  let nonZero = 0;
  let flux = 0;

  for ( let i = 0; i < N; i++ ) {
    const m = freqData[ i ];
    const f = i * sampleRate / fftSize;

    totalMag += m;
    weightedFreq += m * f;

    if ( m > 0 ) {
      logSum += Math.log( m + 1 );
      nonZero++;
    }

    const d = m - state.prev[ i ];

    if ( d > 0 ) {
      flux += d;
    }

    state.prev[ i ] = m;
  }

  const centroid = totalMag > 0 ? weightedFreq / totalMag : 0;
  let cum = 0;
  const threshold = totalMag * 0.85;
  let rolloffBin = N - 1;

  for ( let i = 0; i < N; i++ ) {
    cum += freqData[ i ];

    if ( cum >= threshold ) {
      rolloffBin = i;
      break;
    }
  }

  const rolloff = rolloffBin * sampleRate / fftSize;
  const arithMean = totalMag / N;
  const geoMean = nonZero > 0 ? Math.exp( logSum / nonZero ) - 1 : 0;
  const flatness = arithMean > 0 ? Math.min(
    1,
    geoMean / arithMean
  ) : 0;
  const fluxNorm = flux / ( N * 255 );

  return {
    centroid,
    rolloff,
    flatness,
    flux: fluxNorm
  };
}

// ── Instrument heuristics (rough probabilistic scores, not labels) ─────────

export function instrumentHeuristics( features ) {
  const bands = features.bands ?? {};
  const sp = features.spectral ?? {};
  const kick = features.kick ?? {};
  const onset = features.onset ?? {};
  const voice = features.voice ?? {};

  const bass = bands.bass ?? 0;
  const presence = bands.presence ?? 0;
  const brilliance = bands.brilliance ?? 0;
  const mid = bands.mid ?? 0;
  const centroid = sp.centroid ?? 0;
  const flatness = sp.flatness ?? 0;

  const kickScore = Math.max(
    kick.strength ?? 0,
    Math.min(
      1,
      bass * 2
    )
  );
  const hatScore = Math.min(
    1,
    brilliance * 1.5 * ( centroid > 4000 ? 1 : 0.4 )
  );
  const snareScore = Math.min(
    1,
    ( onset.strength ?? 0 ) * Math.min(
      1,
      flatness * 2
    )
  );
  const voiceScore = voice.confidence ?? 0;
  const sustainedScore = ( 1 - flatness ) * Math.min(
    1,
    presence + 0.5 * mid
  );

  return {
    kick: kickScore,
    hat: hatScore,
    snare: snareScore,
    voice: voiceScore,
    sustained: sustainedScore
  };
}
