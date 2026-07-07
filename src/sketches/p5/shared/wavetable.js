// ─────────────────────────────────────────────────────────────────────────────
// WAVETABLE — a small, deterministic wavetable engine (Ableton Wavetable-style).
//
// A wavetable is a stack of single-cycle waveforms ("frames"); a voice scans
// (morphs) through the stack while looping one frame at audio rate. This module
// owns three concerns, and deliberately nothing else:
//
//   1. Generation  — `generateWavetable( spec )` builds a table from a compact,
//      seeded spec (additive shapes, random harmonics, FM, formants). The same
//      spec always yields the exact same table, so a table can be regenerated
//      from its spec alone.
//   2. Sampling    — `sampleWavetable( table, morph, phase )` reads the table
//      with bilinear interpolation (across frames and within a frame), and
//      `renderNotePcm( … )` bakes a whole note (pitch, morph sweep, envelope,
//      drive) into a Float32Array with pure math — no AudioContext involved,
//      so live playback, realtime recording and deterministic offline renders
//      all consume byte-identical PCM.
//   3. Portability — `serializeWavetable` / `parseWavetable` /
//      `downloadWavetable` move tables through a versioned .json format that
//      stores BOTH the baked frames (authoritative) and the generating spec
//      (provenance), so any other sketch can reload or re-derive the sound.
//
// The module is intentionally import-free: it runs unchanged in the browser,
// in the headless recording pipeline, and under plain Node (e.g. to bake the
// preset .json files that live next to it in `shared/wavetables/`).
// ─────────────────────────────────────────────────────────────────────────────

export const WAVETABLE_FORMAT = "p5t-wavetable";
export const WAVETABLE_VERSION = 1;

const TAU = Math.PI * 2;

/**
 * Deterministic 32-bit PRNG (mulberry32) — the seed is part of the wavetable
 * spec, and sketches reuse it for anything else that must replay identically
 * (e.g. seeded note patterns).
 */
export function createSeededRandom( seed ) {
  let t = seed >>> 0;

  return () => {
    t = ( t + 0x6d2b79f5 ) >>> 0;

    let r = Math.imul(
      t ^ ( t >>> 15 ),
      1 | t
    );

    r ^= r + Math.imul(
      r ^ ( r >>> 7 ),
      61 | r
    );

    return ( ( r ^ ( r >>> 14 ) ) >>> 0 ) / 4294967296;
  };
}

/** Sum a list of { n, amp, phase } partials into one single-cycle frame. */
function additiveFrame(
  frameSize, partials
) {
  const out = new Float32Array( frameSize );

  for ( const partial of partials ) {
    if ( !partial.amp ) {
      continue;
    }

    for ( let k = 0; k < frameSize; k++ ) {
      out[ k ] += partial.amp * Math.sin( TAU * partial.n * ( k / frameSize ) + ( partial.phase ?? 0 ) );
    }
  }

  return out;
}

/** Remove DC offset and normalise the frame to a safe peak. */
function finishFrame( frame ) {
  let mean = 0;

  for ( let k = 0; k < frame.length; k++ ) {
    mean += frame[ k ];
  }

  mean /= frame.length;

  let peak = 0;

  for ( let k = 0; k < frame.length; k++ ) {
    frame[ k ] -= mean;
    peak = Math.max(
      peak,
      Math.abs( frame[ k ] )
    );
  }

  if ( peak > 0 ) {
    for ( let k = 0; k < frame.length; k++ ) {
      frame[ k ] *= 0.95 / peak;
    }
  }

  return frame;
}

/**
 * Fourier amplitude of harmonic `n` for the classic analog shapes. `character`
 * only matters for "pulse", where it sets the duty cycle.
 */
function shapeAmp(
  shape, n, character
) {
  switch ( shape ) {
    case "sine":
      return n === 1 ? 1 : 0;
    case "triangle":
      return n % 2 === 1
        ? ( 8 / ( Math.PI * Math.PI ) ) * ( ( n % 4 === 1 ? 1 : -1 ) / ( n * n ) )
        : 0;
    case "saw":
      return ( 2 / Math.PI ) / n;
    case "square":
      return n % 2 === 1 ? ( 4 / Math.PI ) / n : 0;
    case "pulse": {
      const duty = 0.12 + 0.38 * character;

      return ( 2 / ( n * Math.PI ) ) * Math.sin( Math.PI * n * duty );
    }
    default:
      return 0;
  }
}

const SHAPE_SEQUENCE = [
  "sine",
  "triangle",
  "saw",
  "square",
  "pulse"
];

/**
 * Build the per-frame partial lists for one generator mode. Every mode is a
 * pure function of the spec (all randomness goes through the seeded PRNG), so
 * regeneration is exact.
 */
function buildPartialFrames( {
  mode,
  frames,
  frameSize,
  harmonics,
  brightness,
  character,
  seed
} ) {
  const rng = createSeededRandom( seed );
  const partialCount = Math.max(
    1,
    Math.min(
      harmonics,
      Math.floor( frameSize / 2 ) - 1
    )
  );
  const rolloff = ( n ) => Math.exp( -( 1 - brightness ) * 0.22 * ( n - 1 ) );
  const result = [];

  if ( mode === "harmonics" ) {
    // Seeded harmonic amplitudes that random-walk from frame to frame; the
    // phases stay fixed so the morph reads as one evolving timbre rather
    // than unrelated snapshots.
    const phases = [];
    const amps = [];
    const tilt = 2.2 - 1.6 * brightness;

    for ( let n = 1; n <= partialCount; n++ ) {
      phases.push( rng() * TAU );
      amps.push( Math.pow(
        rng(),
        1.5
      ) / Math.pow(
        n,
        tilt
      ) );
    }

    for ( let fi = 0; fi < frames; fi++ ) {
      const partials = [];

      for ( let n = 1; n <= partialCount; n++ ) {
        if ( fi > 0 ) {
          amps[ n - 1 ] *= Math.exp( ( rng() - 0.5 ) * character * 1.6 );
        }

        partials.push( {
          n,
          amp: amps[ n - 1 ],
          phase: phases[ n - 1 ]
        } );
      }

      result.push( partials );
    }

    return result;
  }

  if ( mode === "formant" ) {
    // A few gaussian resonance bands over the harmonic series, drifting
    // upward/downward across frames — vowel-ish, pad-friendly spectra.
    const bands = [];

    for ( let b = 0; b < 3; b++ ) {
      bands.push( {
        center: 1 + rng() * partialCount * 0.8,
        width: 1 + rng() * partialCount * 0.12,
        gain: 0.4 + rng() * 0.6,
        drift: ( rng() - 0.5 ) * character * partialCount * 1.2
      } );
    }

    const phases = [];

    for ( let n = 1; n <= partialCount; n++ ) {
      phases.push( rng() * TAU );
    }

    for ( let fi = 0; fi < frames; fi++ ) {
      const t = frames > 1 ? fi / ( frames - 1 ) : 0;
      const partials = [];

      for ( let n = 1; n <= partialCount; n++ ) {
        let amp = 0;

        for ( const band of bands ) {
          const center = band.center + band.drift * t;
          const distance = ( n - center ) / band.width;

          amp += band.gain * Math.exp( -0.5 * distance * distance );
        }

        partials.push( {
          n,
          amp: ( amp / Math.sqrt( n ) ) * rolloff( n ),
          phase: phases[ n - 1 ]
        } );
      }

      result.push( partials );
    }

    return result;
  }

  // Default: "shapes" — crossfade through the classic analog shapes so the
  // morph axis reads sine → triangle → saw → square → pulse, with brightness
  // acting as a spectral low-pass tilt.
  for ( let fi = 0; fi < frames; fi++ ) {
    const t = frames > 1 ? fi / ( frames - 1 ) : 0;
    const position = t * ( SHAPE_SEQUENCE.length - 1 );
    const lower = SHAPE_SEQUENCE[ Math.floor( position ) ];
    const upper = SHAPE_SEQUENCE[ Math.min(
      Math.ceil( position ),
      SHAPE_SEQUENCE.length - 1
    ) ];
    const blend = position - Math.floor( position );
    const partials = [];

    for ( let n = 1; n <= partialCount; n++ ) {
      const amp = ( shapeAmp(
        lower,
        n,
        character
      ) * ( 1 - blend ) + shapeAmp(
        upper,
        n,
        character
      ) * blend ) * rolloff( n );

      partials.push( {
        n,
        amp,
        phase: 0
      } );
    }

    result.push( partials );
  }

  return result;
}

/**
 * FM frames are cheaper to compute directly in the time domain than as
 * partials: a 2-operator stack whose modulation index sweeps across frames.
 */
function buildFmFrames( {
  frames,
  frameSize,
  brightness,
  character,
  seed
} ) {
  const rng = createSeededRandom( seed );
  const ratios = [
    1,
    2,
    3,
    1.5,
    0.5
  ];
  const ratio = ratios[ Math.floor( rng() * ratios.length ) ];
  const modPhase = rng() * TAU;
  const indexStart = character * 1.5;
  const indexEnd = 0.5 + brightness * 8;
  const result = [];

  for ( let fi = 0; fi < frames; fi++ ) {
    const t = frames > 1 ? fi / ( frames - 1 ) : 0;
    const index = indexStart + ( indexEnd - indexStart ) * t;
    const frame = new Float32Array( frameSize );

    for ( let k = 0; k < frameSize; k++ ) {
      const phase = k / frameSize;

      frame[ k ] = Math.sin( TAU * phase + index * Math.sin( TAU * ratio * phase + modPhase ) );
    }

    result.push( finishFrame( frame ) );
  }

  return result;
}

/**
 * Build a wavetable from a spec. Fully deterministic: the same spec object
 * always produces the same frames, which is what makes the stored `spec` in
 * the .json a faithful regeneration recipe.
 *
 * @returns {{ name, frameSize, frames: Float32Array[], spec }}
 */
export function generateWavetable( spec = {} ) {
  const resolved = {
    mode: spec.mode ?? "shapes",
    frames: Math.max(
      1,
      Math.round( spec.frames ?? 8 )
    ),
    frameSize: Math.max(
      16,
      Math.round( spec.frameSize ?? 256 )
    ),
    harmonics: Math.max(
      1,
      Math.round( spec.harmonics ?? 32 )
    ),
    brightness: Math.min(
      1,
      Math.max(
        0,
        spec.brightness ?? 0.7
      )
    ),
    character: Math.min(
      1,
      Math.max(
        0,
        spec.character ?? 0.5
      )
    ),
    seed: Math.max(
      1,
      Math.round( spec.seed ?? 1 )
    ),
    name: spec.name || "untitled"
  };

  const frames = resolved.mode === "fm"
    ? buildFmFrames( resolved )
    : buildPartialFrames( resolved ).map( ( partials ) => finishFrame( additiveFrame(
      resolved.frameSize,
      partials
    ) ) );

  return {
    name: resolved.name,
    frameSize: resolved.frameSize,
    frames,
    spec: resolved
  };
}

/**
 * Read the table at ( morph ∈ [0,1], phase ∈ [0,1) ) with bilinear
 * interpolation — linear between the two nearest frames, linear between the
 * two nearest samples (wrapping) inside each frame. This is the single
 * sampling routine shared by the visual display and the PCM renderer.
 */
export function sampleWavetable(
  table, morph, phase
) {
  const frames = table.frames;
  const lastFrame = frames.length - 1;
  const position = Math.min(
    1,
    Math.max(
      0,
      morph
    )
  ) * lastFrame;
  const lowIndex = Math.floor( position );
  const highIndex = Math.min(
    lowIndex + 1,
    lastFrame
  );
  const frameBlend = position - lowIndex;

  const size = table.frameSize;
  const scaled = ( ( phase % 1 ) + 1 ) % 1 * size;
  const k0 = Math.floor( scaled ) % size;
  const k1 = ( k0 + 1 ) % size;
  const sampleBlend = scaled - Math.floor( scaled );

  const low = frames[ lowIndex ][ k0 ] * ( 1 - sampleBlend ) + frames[ lowIndex ][ k1 ] * sampleBlend;
  const high = frames[ highIndex ][ k0 ] * ( 1 - sampleBlend ) + frames[ highIndex ][ k1 ] * sampleBlend;

  return low * ( 1 - frameBlend ) + high * frameBlend;
}

/**
 * Bake one note into mono PCM with pure math: phase-accumulate through the
 * table at `freq`, sweep the morph position from `morphFrom` to `morphTo`,
 * apply a linear attack/release envelope and an optional tanh drive.
 *
 * Because there is no audio graph involved, the exact same samples come out
 * in the live preview, the realtime recorder and the offline deterministic
 * render — the buffer IS the sound.
 */
export function renderNotePcm(
  table, {
    freq = 220,
    duration = 0.5,
    sampleRate = 48000,
    morphFrom = 0,
    morphTo = 0,
    attack = 0.01,
    release = 0.15,
    gain = 0.5,
    drive = 0
  } = {}
) {
  const length = Math.max(
    1,
    Math.ceil( duration * sampleRate )
  );
  const out = new Float32Array( length );
  const driveAmount = 1 + drive * 4;
  const driveNorm = drive > 0 ? Math.tanh( driveAmount ) : 1;
  let phase = 0;

  for ( let i = 0; i < length; i++ ) {
    const t = i / sampleRate;
    const progress = duration > 0 ? t / duration : 0;
    const morph = morphFrom + ( morphTo - morphFrom ) * progress;

    let sample = sampleWavetable(
      table,
      morph,
      phase
    );

    if ( drive > 0 ) {
      sample = Math.tanh( sample * driveAmount ) / driveNorm;
    }

    const envelope = Math.min(
      1,
      attack > 0 ? t / attack : 1,
      release > 0 ? ( duration - t ) / release : 1
    );

    out[ i ] = sample * Math.max(
      0,
      envelope
    ) * gain;
    phase += freq / sampleRate;
  }

  return out;
}

/**
 * Serialise a table to the portable .json format. Frames are rounded to four
 * decimals — inaudible, and it keeps the files small enough to paste into a
 * textarea or commit next to a sketch.
 */
export function serializeWavetable( table ) {
  return JSON.stringify(
    {
      format: WAVETABLE_FORMAT,
      version: WAVETABLE_VERSION,
      name: table.name ?? "untitled",
      frameSize: table.frameSize,
      frameCount: table.frames.length,
      spec: table.spec ?? null,
      frames: table.frames.map( ( frame ) => Array.from(
        frame,
        ( value ) => Math.round( value * 10000 ) / 10000
      ) )
    },
    null,
    1
  );
}

/**
 * Parse a .json wavetable (string or already-parsed object) back into a
 * runtime table. The baked frames are authoritative; the stored spec rides
 * along so a sketch can also regenerate/tweak the table from its recipe.
 * Throws on anything that is not a valid table, so callers can fall back.
 */
export function parseWavetable( source ) {
  const data = typeof source === "string" ? JSON.parse( source ) : source;

  if ( !data || data.format !== WAVETABLE_FORMAT || !Array.isArray( data.frames ) || data.frames.length === 0 ) {
    throw new Error( "parseWavetable: not a valid wavetable .json payload." );
  }

  const frameSize = data.frameSize ?? data.frames[ 0 ].length;
  const frames = data.frames.map( ( frame ) => {
    const out = new Float32Array( frameSize );

    for ( let k = 0; k < frameSize; k++ ) {
      out[ k ] = Number( frame[ k ] ) || 0;
    }

    return out;
  } );

  return {
    name: data.name ?? "untitled",
    frameSize,
    frames,
    spec: data.spec ?? null
  };
}

/** Trigger a browser download of the table as a `.json` file. */
export function downloadWavetable(
  table, filename
) {
  if ( typeof document === "undefined" ) {
    return;
  }

  const slug = ( table.name ?? "wavetable" )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    ) || "wavetable";
  const blob = new Blob(
    [
      serializeWavetable( table )
    ],
    {
      type: "application/json"
    }
  );
  const url = URL.createObjectURL( blob );
  const anchor = document.createElement( "a" );

  anchor.href = url;
  anchor.download = filename ?? `${ slug }.wavetable.json`;
  document.body.appendChild( anchor );
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL( url );
}
