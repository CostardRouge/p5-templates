import {
  HAND_CLIP_QUANT,
  handClipGap,
  handClipLayout
} from "@/p5/shared/handClip.js";

// ─────────────────────────────────────────────────────────────────────────────
// HAND CLIP PROCESSING — everything expensive happens HERE, once, at bake time.
//
// MediaPipe inference is irregular (~25–35 fps, worker round-trips, dropped
// frames) while playback wants a uniform 60 fps it can sample with one index
// and one lerp. This module turns a raw take — timestamped landmark samples,
// as accumulated by the studio's recorder — into a baked `p5t-handclip`:
//
//   dedupe → smooth (zero-phase One-Euro) → resample (uniform Hermite) →
//   detect pinch phases → derive grab/release anchors → assemble the clip
//
// Two choices worth defending:
//
//   • One-Euro over plain EMA: its cutoff adapts to speed — heavy smoothing
//     while the hand hovers (where jitter shows), none while it sweeps (where
//     lag shows). And because baking is offline we run it forward AND backward
//     (filtfilt-style), which cancels the phase lag a live filter must accept.
//   • Hermite resampling on the real timestamps (Catmull-Rom tangents): C1
//     smooth, reproduces straight-line motion exactly, and honest about the
//     irregular capture intervals instead of pretending they were uniform.
//
// Everything below is pure math over plain arrays — no p5, no DOM, no
// MediaPipe — mirroring pinchMath.js so it stays cheap to unit-test. A raw
// take is `Array<{ t, points }>`: `t` in SECONDS from the start of the take,
// strictly increasing; `points` = one hand's landmarks in normalized 0..1
// capture space (x already in display orientation), all samples sharing the
// clip layout's point count.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop samples that don't advance the take: non-increasing timestamps, and
 * the INTERIOR of any run of repeated landmarks (every coordinate within
 * `epsilon`). The first and last sample of a run are both kept — a run is
 * either one inference result re-polled by the 60 fps draw loop or a hand
 * genuinely held still, and in both cases keeping the run's endpoints
 * preserves the hold's timing exactly (interpolating between two equal
 * samples is constant) while the collapsed interior can no longer read as
 * micro-freezes once resampled. Dropping the endpoints too would silently
 * trim a take that ends on a held pose.
 */
export function dedupeSamples(
  samples, epsilon = 0
) {
  const out = [];
  // Latest repeat of out's tail — held back so only the LAST repeat of a run
  // survives next to its first.
  let pending = null;

  const repeats = (
    sample, prev
  ) => {
    if ( sample.points.length !== prev.points.length ) {
      return false;
    }

    for ( let i = 0; i < sample.points.length; i++ ) {
      if (
        Math.abs( sample.points[ i ].x - prev.points[ i ].x ) > epsilon ||
        Math.abs( sample.points[ i ].y - prev.points[ i ].y ) > epsilon
      ) {
        return false;
      }
    }

    return true;
  };

  for ( const sample of samples ?? [] ) {
    if ( !sample || !Array.isArray( sample.points ) || !Number.isFinite( sample.t ) ) {
      continue;
    }

    const latest = pending ?? out[ out.length - 1 ];

    if ( latest && sample.t <= latest.t ) {
      continue;
    }

    if ( out.length > 0 && repeats(
      sample,
      out[ out.length - 1 ]
    ) ) {
      pending = sample;
      continue;
    }

    if ( pending ) {
      out.push( pending );
      pending = null;
    }

    out.push( sample );
  }

  if ( pending ) {
    out.push( pending );
  }

  return out;
}

/**
 * One scalar One-Euro filter (Casiez et al.): an adaptive low-pass whose
 * cutoff rises with the signal's speed. `minCutoff` (Hz) sets how hard slow
 * motion is smoothed, `beta` how quickly fast motion escapes the smoothing,
 * `dCutoff` the low-pass on the speed estimate itself.
 */
export function createOneEuroFilter( {
  minCutoff = 1.2,
  beta = 0.02,
  dCutoff = 1
} = {} ) {
  let prevT = null;
  let prevValue = 0;
  let prevSpeed = 0;

  const alpha = (
    cutoff, dt
  ) => {
    const tau = 1 / ( 2 * Math.PI * cutoff );

    return 1 / ( 1 + tau / dt );
  };

  return {
    /** Feed one timestamped value (t in seconds); returns the filtered value. */
    step(
      t, value
    ) {
      if ( prevT === null ) {
        prevT = t;
        prevValue = value;
        prevSpeed = 0;

        return value;
      }

      const dt = Math.max(
        t - prevT,
        1e-6
      );
      const speed = ( value - prevValue ) / dt;

      prevSpeed += alpha(
        dCutoff,
        dt
      ) * ( speed - prevSpeed );

      const cutoff = minCutoff + beta * Math.abs( prevSpeed );

      prevValue += alpha(
        cutoff,
        dt
      ) * ( value - prevValue );
      prevT = t;

      return prevValue;
    },

    /** Forget everything (start of a new pass). */
    reset() {
      prevT = null;
      prevValue = 0;
      prevSpeed = 0;
    }
  };
}

// One One-Euro pass over every coordinate channel of a take, in the order the
// samples are given. Returns a new take; the input is never mutated.
function filterPass(
  samples, config
) {
  if ( samples.length === 0 ) {
    return [];
  }

  const channels = samples[ 0 ].points.length * 2;
  const filters = [];

  for ( let c = 0; c < channels; c++ ) {
    filters.push( createOneEuroFilter( config ) );
  }

  return samples.map( ( sample ) => ( {
    t: sample.t,
    points: sample.points.map( (
      point, index
    ) => ( {
      x: filters[ index * 2 ].step(
        sample.t,
        point.x
      ),
      y: filters[ index * 2 + 1 ].step(
        sample.t,
        point.y
      )
    } ) )
  } ) );
}

/**
 * Zero-phase smoothing of a take: One-Euro forward, then the result again
 * backward (timestamps mirrored so the filter still sees increasing time),
 * filtfilt-style. The backward pass cancels the forward pass's lag — a
 * symmetric gesture stays symmetric, peaks stay where the hand put them.
 * Only possible because baking is offline; live smoothing can't see the
 * future. `zeroPhase: false` keeps the single forward pass.
 */
export function smoothSamples(
  samples, {
    minCutoff = 1.2,
    beta = 0.02,
    dCutoff = 1,
    zeroPhase = true
  } = {}
) {
  const config = {
    minCutoff,
    beta,
    dCutoff
  };
  const forward = filterPass(
    samples,
    config
  );

  if ( !zeroPhase || forward.length < 2 ) {
    return forward;
  }

  const end = forward[ forward.length - 1 ].t;
  const mirrored = [
    ...forward
  ].reverse().map( ( sample ) => ( {
    t: end - sample.t,
    points: sample.points
  } ) );
  const backward = filterPass(
    mirrored,
    config
  );

  return backward.reverse().map( (
    sample, index
  ) => ( {
    t: forward[ index ].t,
    points: sample.points
  } ) );
}

// Cubic Hermite value on the segment [i, i+1] of one coordinate channel, with
// Catmull-Rom tangents from the REAL (irregular) timestamps — one-sided at the
// take's ends. Reproduces linear motion exactly and is C1 across segments.
function hermiteAt(
  samples, channel, segment, t
) {
  const read = ( index ) => {
    const point = samples[ index ].points[ channel >> 1 ];

    return channel % 2 === 0 ? point.x : point.y;
  };
  const t0 = samples[ segment ].t;
  const t1 = samples[ segment + 1 ].t;
  const h = t1 - t0;
  const x0 = read( segment );
  const x1 = read( segment + 1 );
  const before = segment > 0 ? segment - 1 : segment;
  const after = segment + 2 < samples.length ? segment + 2 : segment + 1;
  const m0 = ( x1 - read( before ) ) / ( t1 - samples[ before ].t ) || 0;
  const m1 = ( read( after ) - x0 ) / ( samples[ after ].t - t0 ) || 0;
  const s = ( t - t0 ) / h;
  const s2 = s * s;
  const s3 = s2 * s;

  return (
    ( 2 * s3 - 3 * s2 + 1 ) * x0 +
    ( s3 - 2 * s2 + s ) * h * m0 +
    ( -2 * s3 + 3 * s2 ) * x1 +
    ( s3 - s2 ) * h * m1
  );
}

/**
 * Resample an irregular take to a uniform frame grid near `fps`, as one flat
 * Float32Array (`frameCount × pointCount × 2`). The grid spans the take
 * exactly — first frame = first sample, last frame = last sample — so the
 * returned `fps` is the ACTUAL rate `( frameCount − 1 ) / duration`, within
 * half a frame of the requested one; playback timing stays honest instead of
 * silently stretching the take.
 */
export function resampleUniform(
  samples, fps = 60
) {
  if ( !samples || samples.length < 2 ) {
    throw new Error( "resampleUniform: need at least 2 samples to resample." );
  }

  const pointCount = samples[ 0 ].points.length;
  const start = samples[ 0 ].t;
  const duration = samples[ samples.length - 1 ].t - start;

  if ( !( duration > 0 ) ) {
    throw new Error( "resampleUniform: take has no duration." );
  }

  const frameCount = Math.max(
    2,
    Math.round( duration * fps ) + 1
  );
  const frames = new Float32Array( frameCount * pointCount * 2 );
  let segment = 0;

  for ( let frame = 0; frame < frameCount; frame++ ) {
    const t = start + duration * frame / ( frameCount - 1 );

    while ( segment < samples.length - 2 && samples[ segment + 1 ].t < t ) {
      segment++;
    }

    for ( let channel = 0; channel < pointCount * 2; channel++ ) {
      frames[ frame * pointCount * 2 + channel ] = hermiteAt(
        samples,
        channel,
        segment,
        t
      );
    }
  }

  return {
    frames,
    frameCount,
    fps: ( frameCount - 1 ) / duration
  };
}

/**
 * Thumb/index tip gap of every frame of a baked clip (or anything shaped
 * `{ frames, frameCount, layout }`), in normalized units.
 */
export function gapSeries( clip ) {
  const gaps = new Float32Array( clip.frameCount );

  for ( let frame = 0; frame < clip.frameCount; frame++ ) {
    gaps[ frame ] = handClipGap(
      clip,
      frame
    );
  }

  return gaps;
}

// Below this normalized gap range the take never really pinched — auto phase
// detection refuses to invent one out of tracking noise.
const MIN_GAP_RANGE = 0.015;

/**
 * Find the clip's pinch interval in a gap series, with the same hysteresis
 * shape as the live tracker (stepPinch): engage below `closeThreshold`,
 * release only above `openThreshold`. Thresholds default to fractions of the
 * series' own range, so a take pinches relative to ITS hand size — the studio
 * can override them per take.
 *
 * Returns `{ enter, close, drag, open, exit }` (frame index pairs / indices,
 * `drag` = [close, open) — the longest engaged interval) or null when the
 * series never dips convincingly.
 */
export function detectPhases(
  gaps, {
    closeThreshold,
    openThreshold
  } = {}
) {
  const frameCount = gaps.length;

  if ( frameCount === 0 ) {
    return null;
  }

  let min = Infinity;
  let max = -Infinity;

  for ( let frame = 0; frame < frameCount; frame++ ) {
    min = Math.min(
      min,
      gaps[ frame ]
    );
    max = Math.max(
      max,
      gaps[ frame ]
    );
  }

  const close = closeThreshold ?? min + ( max - min ) * 0.3;
  const open = openThreshold ?? min + ( max - min ) * 0.55;

  if ( closeThreshold === undefined && max - min < MIN_GAP_RANGE ) {
    return null;
  }

  let best = null;
  let startedAt = -1;

  for ( let frame = 0; frame < frameCount; frame++ ) {
    const engaged = startedAt >= 0 ? gaps[ frame ] <= open : gaps[ frame ] <= close;

    if ( engaged && startedAt < 0 ) {
      startedAt = frame;
    }

    if ( ( !engaged || frame === frameCount - 1 ) && startedAt >= 0 ) {
      const end = engaged ? frameCount : frame;

      if ( !best || end - startedAt > best[ 1 ] - best[ 0 ] ) {
        best = [
          startedAt,
          end
        ];
      }

      startedAt = -1;
    }
  }

  if ( !best ) {
    return null;
  }

  return {
    enter: [
      0,
      best[ 0 ]
    ],
    close: best[ 0 ],
    drag: [
      best[ 0 ],
      best[ 1 ]
    ],
    open: best[ 1 ],
    exit: [
      best[ 1 ],
      frameCount
    ]
  };
}

// Thumb/index midpoint of one frame — where the pinch "is".
function pinchMidAt(
  clip, frame
) {
  const layout = handClipLayout( clip );
  const base = frame * layout.pointCount * 2;
  const thumb = base + layout.thumbTip * 2;
  const index = base + layout.indexTip * 2;

  return {
    x: ( clip.frames[ thumb ] + clip.frames[ index ] ) / 2,
    y: ( clip.frames[ thumb + 1 ] + clip.frames[ index + 1 ] ) / 2
  };
}

/**
 * The retargeting anchors of a clip with detected phases: where the pinch
 * closed (`grab`) and where it let go (`release`), as thumb/index midpoints
 * in normalized clip space. Playback maps grab→A and release→B.
 */
export function deriveAnchors(
  clip, phases
) {
  if ( !phases ) {
    return null;
  }

  return {
    grab: pinchMidAt(
      clip,
      phases.close
    ),
    release: pinchMidAt(
      clip,
      Math.min(
        phases.open,
        clip.frameCount - 1
      )
    )
  };
}

/**
 * The whole bake: raw take in, runtime `p5t-handclip` out (the same shape
 * `parseHandClip` returns — hand it to `serializeHandClip` to export).
 *
 * @param {Array<{ t: number, points: Array<{x, y}> }>} samples - Raw take,
 *   t in seconds, points in normalized capture space.
 * @param {object} [config]
 * @param {string} [config.name] - Clip name (drives the export filename).
 * @param {string[]} [config.tags]
 * @param {string} [config.handedness] - "Left" / "Right" / "".
 * @param {string} [config.layout="landmarks-21"] - Point layout of the take.
 * @param {number} [config.aspect=4/3] - Capture frame aspect (width/height).
 * @param {number} [config.fps=60] - Target frame rate to bake at.
 * @param {object|false} [config.filter] - smoothSamples config, false to skip.
 * @param {object} [config.pinch] - detectPhases thresholds override.
 * @param {string|null} [config.recordedAt] - ISO timestamp for provenance.
 * @returns {import("@/p5/shared/handClip.js").HandClip} the baked runtime
 *   clip — hand it to `serializeHandClip` to export.
 */
export function bakeHandClip(
  samples, {
    name = "untitled",
    tags = [],
    handedness = "",
    layout = "landmarks-21",
    aspect = 4 / 3,
    fps = 60,
    filter = {},
    pinch = {},
    recordedAt = null
  } = {}
) {
  const pointCount = handClipLayout( layout ).pointCount;
  const deduped = dedupeSamples( samples );

  if ( deduped.length < 2 ) {
    throw new Error( "bakeHandClip: take too short (need at least 2 distinct samples)." );
  }

  for ( const sample of deduped ) {
    if ( sample.points.length !== pointCount ) {
      throw new Error( `bakeHandClip: sample has ${ sample.points.length } points, layout "${ layout }" expects ${ pointCount }.` );
    }
  }

  const smoothed = filter === false
    ? deduped
    : smoothSamples(
      deduped,
      filter
    );
  const resampled = resampleUniform(
    smoothed,
    fps
  );
  const clip = {
    name,
    tags,
    handedness,
    fps: resampled.fps,
    frameCount: resampled.frameCount,
    layout,
    aspect,
    quant: HAND_CLIP_QUANT,
    frames: resampled.frames,
    phases: null,
    anchors: null,
    gapRange: null,
    capture: {
      sourceFps: ( deduped.length - 1 ) / ( deduped[ deduped.length - 1 ].t - deduped[ 0 ].t ),
      samples: deduped.length,
      recordedAt
    }
  };
  const gaps = gapSeries( clip );
  let gapMin = Infinity;
  let gapMax = -Infinity;

  for ( let frame = 0; frame < gaps.length; frame++ ) {
    gapMin = Math.min(
      gapMin,
      gaps[ frame ]
    );
    gapMax = Math.max(
      gapMax,
      gaps[ frame ]
    );
  }

  clip.gapRange = [
    gapMin,
    gapMax
  ];
  clip.phases = detectPhases(
    gaps,
    pinch
  );
  clip.anchors = deriveAnchors(
    clip,
    clip.phases
  );

  return clip;
}
