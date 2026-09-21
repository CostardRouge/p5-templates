import {
  hashedRandom
} from "@/p5/utils/letterPaths.js";

// ─────────────────────────────────────────────────────────────────────────────
// The lattice the sculpt category runs on: a seeded cloud of points in a unit
// volume, and the graph of links between them.
//
// It is pure geometry and knows nothing about how it is drawn — v1 raymarches
// every link as a tube of the rings material; a later variant can draw the same
// lattice in another style without rebuilding anything here. Two rules make it
// safe to animate on top of:
//
//   • Everything is a pure function of the seed. There is no Math.random and no
//     p5 noise (p5 seeds its permutation table from Math.random unless told
//     otherwise), so the same options give the same lattice in the studio and
//     in deterministic capture.
//   • Links are computed on the REST positions and never on the animated ones.
//     Two neighbours that drift past each other would otherwise swap places in
//     the k-nearest ranking and rewire the graph mid-loop, which reads as a
//     link blinking.
//
// Positions come out in a unit volume (radius 1, centred on the origin, y up);
// the sketch scales them to world units. The generator skips `_`-prefixed
// files, so this module is not a sketch.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_POINTS = 48; // uniform-array size in the sketch
export const MAX_LINKS = 96; // rings v10's proven capsule budget
export const VOLUMES = [
  "sphere",
  "box",
  "disc",
  "shell"
];

const TAU = Math.PI * 2;

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

// Seeded [0, 1) from a few integer coordinates — the one source of "random"
// for the whole category.
export function hash01(
  seed, ...parts
) {
  let n = Math.round( seed ) * 7919;

  for ( let i = 0; i < parts.length; i++ ) {
    n = ( n + Math.round( parts[ i ] ) * ( 131 + i * 977 ) ) | 0;
  }

  return hashedRandom( n );
}

// One candidate position in the unit volume for candidate index `i`.
function sampleVolume(
  volume, seed, i
) {
  const u = hash01(
    seed,
    i,
    1
  );
  const v = hash01(
    seed,
    i,
    2
  );
  const w = hash01(
    seed,
    i,
    3
  );

  if ( volume === "box" ) {
    return [
      u * 2 - 1,
      v * 2 - 1,
      w * 2 - 1
    ];
  }

  if ( volume === "disc" ) {
    const r = Math.sqrt( u );
    const a = v * TAU;

    return [
      Math.cos( a ) * r,
      Math.sin( a ) * r,
      0
    ];
  }

  // sphere / shell: uniform direction, radius by volume (sphere) or pinned to
  // a thin outer layer (shell).
  const z = u * 2 - 1;
  const a = v * TAU;
  const s = Math.sqrt( Math.max(
    0,
    1 - z * z
  ) );
  const r = volume === "shell"
    ? 0.85 + 0.15 * w
    : Math.cbrt( w );

  return [
    Math.cos( a ) * s * r,
    Math.sin( a ) * s * r,
    z * r
  ];
}

// Build the point cloud. `spacing` is the minimum distance between points as a
// fraction of the rough cell size for `count` points in the volume; candidates
// closer than that are rejected. When a point runs out of tries the floor is
// relaxed rather than the count reduced, so the slider always yields `count`
// points and `spacing` still reads as "more even".
export function buildPoints( {
  count,
  seed,
  spacing,
  volume,
  flatten
} ) {
  const n = clamp(
    Math.round( count ),
    1,
    MAX_POINTS
  );
  const flat = volume === "disc" ? 0 : clamp(
    flatten,
    0,
    1
  );
  const dims = volume === "disc" || flat < 0.05 ? 2 : 3;
  const cell = dims === 2 ? 2 / Math.sqrt( n ) : 2 / Math.cbrt( n );
  let minDist = clamp(
    spacing,
    0,
    1
  ) * cell;

  const points = [];
  let candidate = 0;
  let tries = 0;

  while ( points.length < n ) {
    const raw = sampleVolume(
      volume,
      seed,
      candidate
    );
    const pt = {
      x: raw[ 0 ],
      y: raw[ 1 ],
      z: raw[ 2 ] * flat,
      id: points.length
    };

    candidate++;
    tries++;

    const clear = minDist <= 0 || points.every( ( other ) => Math.hypot(
      other.x - pt.x,
      other.y - pt.y,
      other.z - pt.z
    ) >= minDist );

    if ( clear ) {
      points.push( pt );
      tries = 0;
    } else if ( tries > 60 ) {
      // Too crowded for this floor: relax it and keep going. Deterministic,
      // since the candidate index keeps advancing.
      minDist *= 0.85;
      tries = 0;
    }
  }

  return points;
}

// Build the links: each point reaches for its `neighbours` nearest points
// within `reach` (unit-radius units), duplicates are merged, `density` thins
// the result with a seeded coin per link, and the longest links are dropped
// past MAX_LINKS so the graph stays local rather than truncated arbitrarily.
// Each link carries a stable `u` in [0, 1) for per-link variation.
export function buildLinks(
  points, {
    neighbours,
    reach,
    density,
    seed
  }
) {
  const k = clamp(
    Math.round( neighbours ),
    0,
    6
  );
  const maxLength = Math.max(
    reach,
    0
  );
  const keep = clamp(
    density,
    0,
    1
  );
  const seen = new Set();
  const links = [];

  for ( let i = 0; i < points.length; i++ ) {
    const from = points[ i ];
    const nearest = [];

    for ( let j = 0; j < points.length; j++ ) {
      if ( j === i ) {
        continue;
      }

      const to = points[ j ];
      const d = Math.hypot(
        to.x - from.x,
        to.y - from.y,
        to.z - from.z
      );

      if ( d <= maxLength ) {
        nearest.push( {
          j,
          d
        } );
      }
    }

    nearest.sort( (
      a, b
    ) => a.d - b.d );

    for ( let m = 0; m < Math.min(
      k,
      nearest.length
    ); m++ ) {
      const j = nearest[ m ].j;
      const a = Math.min(
        i,
        j
      );
      const b = Math.max(
        i,
        j
      );
      const key = a * MAX_POINTS + b;

      if ( seen.has( key ) ) {
        continue;
      }

      seen.add( key );

      if ( keep < 1 && hash01(
        seed,
        a,
        b,
        11
      ) >= keep ) {
        continue;
      }

      links.push( {
        a,
        b,
        length: nearest[ m ].d,
        u: hash01(
          seed,
          a,
          b,
          13
        )
      } );
    }
  }

  if ( links.length > MAX_LINKS ) {
    links.sort( (
      x, y
    ) => x.length - y.length );
    links.length = MAX_LINKS;
  }

  return links.map( (
    link, id
  ) => ( {
    ...link,
    id
  } ) );
}

// ── Memoised builder ─────────────────────────────────────────────────────────
// Keyed on the parameters, not on the consumer, so several sketch layers with
// the same settings share one lattice.
const latticeMemo = new Map();
const LATTICE_MEMO_MAX = 16;

export function getLattice( cfg ) {
  const key = [
    cfg.count,
    cfg.seed,
    cfg.spacing,
    cfg.volume,
    cfg.flatten,
    cfg.neighbours,
    cfg.reach,
    cfg.density
  ].join( "|" );
  const cached = latticeMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const points = buildPoints( cfg );
  const links = buildLinks(
    points,
    cfg
  );
  const lattice = {
    key,
    points,
    links
  };

  latticeMemo.set(
    key,
    lattice
  );

  if ( latticeMemo.size > LATTICE_MEMO_MAX ) {
    latticeMemo.delete( latticeMemo.keys().next().value );
  }

  return lattice;
}

// ── Seeded value noise, and the loop-closing drift built on it ───────────────

function smooth( t ) {
  return t * t * ( 3 - 2 * t );
}

// Trilinear value noise in [0, 1], seeded — no permutation table to worry
// about, and identical wherever it runs.
export function valueNoise3(
  x, y, z, seed
) {
  const xi = Math.floor( x );
  const yi = Math.floor( y );
  const zi = Math.floor( z );
  const u = smooth( x - xi );
  const v = smooth( y - yi );
  const w = smooth( z - zi );
  const at = (
    dx, dy, dz
  ) => hash01(
    seed,
    xi + dx,
    yi + dy,
    zi + dz,
    17
  );

  const x00 = at(
    0,
    0,
    0
  ) + ( at(
    1,
    0,
    0
  ) - at(
    0,
    0,
    0
  ) ) * u;
  const x10 = at(
    0,
    1,
    0
  ) + ( at(
    1,
    1,
    0
  ) - at(
    0,
    1,
    0
  ) ) * u;
  const x01 = at(
    0,
    0,
    1
  ) + ( at(
    1,
    0,
    1
  ) - at(
    0,
    0,
    1
  ) ) * u;
  const x11 = at(
    0,
    1,
    1
  ) + ( at(
    1,
    1,
    1
  ) - at(
    0,
    1,
    1
  ) ) * u;

  const y0 = x00 + ( x10 - x00 ) * v;
  const y1 = x01 + ( x11 - x01 ) * v;

  return y0 + ( y1 - y0 ) * w;
}

// Where a point has drifted to at loop phase `loop` (0 → 1): the noise is
// sampled on a circle in noise space whose angle is the loop clock, so whole
// `cycles` per loop close exactly, and it is sampled at the point's own rest
// position, so neighbours drift together instead of tearing their links.
export function driftAt(
  point, loop, {
    amplitude,
    cycles,
    scale,
    seed
  }
) {
  if ( !amplitude ) {
    return [
      0,
      0,
      0
    ];
  }

  const turns = Math.max(
    1,
    Math.round( cycles )
  );
  const a = loop * TAU * turns;
  const cx = Math.cos( a ) * 0.8;
  const cy = Math.sin( a ) * 0.8;
  const f = Math.max(
    scale,
    0.01
  );
  const sample = ( offset ) => valueNoise3(
    point.x * f + cx + offset,
    point.y * f + cy + offset * 1.7,
    point.z * f + offset * 0.3,
    seed
  ) * 2 - 1;

  return [
    sample( 0 ) * amplitude,
    sample( 37.2 ) * amplitude,
    sample( 71.9 ) * amplitude
  ];
}
