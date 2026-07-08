/**
 * letter-grid — shared engine for the `letter-grid` category.
 *
 * A VIRTUAL, "infinite" grid of glyphs and a camera that travels cell to cell to
 * spell a word. None of this touches p5: every function is pure and operates on
 * plain numbers/strings so it can be unit-tested in isolation and reused by every
 * variant (the flat v1, the extruded v2, …). The only stateful bit is an opt-in
 * path cache the caller owns.
 *
 *   - the grid       — each cell's glyph is a hash of (col, row, seed), so any
 *                       cell is queryable on demand and nothing is ever stored;
 *   - the path        — one target cell per word glyph, each found OUTSIDE the
 *                       previous one's viewport so the travel crosses unseen
 *                       territory (seeded, hence stable across a loop / recording);
 *   - the reading head — the camera position in cell space as a pure function of
 *                       the loop progression, plus which word cell is "lit".
 */

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const DIGITS = "0123456789";

export function clamp(
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

export function lerp(
  a, b, t
) {
  return a + ( b - a ) * t;
}

// Per-channel lerp between two RGBA arrays → a fresh [r, g, b, a].
export function lerpColor(
  from, to, t
) {
  return [
    lerp(
      from[ 0 ] ?? 0,
      to[ 0 ] ?? 0,
      t
    ),
    lerp(
      from[ 1 ] ?? 0,
      to[ 1 ] ?? 0,
      t
    ),
    lerp(
      from[ 2 ] ?? 0,
      to[ 2 ] ?? 0,
      t
    ),
    lerp(
      from[ 3 ] ?? 255,
      to[ 3 ] ?? 255,
      t
    )
  ];
}

// Deterministic 32-bit hash of a cell coordinate — the engine behind the
// "infinite" grid. Same (col, row, seed) always yields the same glyph.
export function cellHash(
  col, row, seed
) {
  let h = ( Math.imul(
    col | 0,
    374761393
  ) + Math.imul(
    row | 0,
    668265263
  ) + Math.imul(
    seed | 0,
    2246822519
  ) ) >>> 0;

  h = Math.imul(
    h ^ ( h >>> 13 ),
    1274126177
  ) >>> 0;

  return ( h ^ ( h >>> 16 ) ) >>> 0;
}

export function cellChar(
  col, row, seed, alphabet
) {
  return alphabet[ cellHash(
    col,
    row,
    seed
  ) % alphabet.length ];
}

// Small seeded PRNG so the spelled path is stable across frames (and across a
// recording's frames), while still feeling random.
export function mulberry32( seed ) {
  let a = seed >>> 0 || 1;

  return function() {
    a = ( a + 0x6D2B79F5 ) | 0;

    let t = Math.imul(
      a ^ ( a >>> 15 ),
      1 | a
    );

    t = ( t + Math.imul(
      t ^ ( t >>> 7 ),
      61 | t
    ) ) ^ t;

    return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
  };
}

export function resolveAlphabet( cfg ) {
  switch ( cfg.alphabet ) {
    case "digits":
      return DIGITS;
    case "lettersDigits":
      return LETTERS + DIGITS;
    case "custom": {
      const cleaned = [
        ...new Set( ( cfg.customAlphabet ?? "" ).toUpperCase().replace(
          /\s+/g,
          ""
        ) )
      ].join( "" );

      return cleaned.length ? cleaned : LETTERS;
    }
    default:
      return LETTERS;
  }
}

// The word as a sequence of grid-legal glyphs (spaces dropped, uppercased).
export function wordGlyphs( value ) {
  return [
    ...( value ?? "" ).toUpperCase()
  ].filter( ( ch ) => /\S/.test( ch ) );
}

// The grid alphabet augmented with every glyph the word needs, so spelling works
// even under a restrictive alphabet (e.g. digits-only) — otherwise the cell
// search for a letter could never land.
export function buildAlphabet(
  cfg, glyphs
) {
  return [
    ...new Set( [
      ...resolveAlphabet( cfg ),
      ...glyphs
    ] )
  ].join( "" );
}

// Find a cell whose glyph is `ch`, in an annulus around `around`. For the very
// first letter we look CLOSE to the origin (the camera boots already centred on
// it, so its absolute position is invisible); for the rest we look BEYOND the
// viewport so the travel crosses unseen territory. Falls back to a deterministic
// outward scan, then to overriding a far cell, so a match is always returned.
export function findCellFor( {
  ch,
  around,
  rng,
  seed,
  alphabet,
  viewRadius,
  spread,
  near
} ) {
  const minR = near ? 0 : viewRadius * 1.25;
  const maxR = near
    ? Math.max(
      7,
      viewRadius * 1.5
    )
    : viewRadius * ( 1.25 + 3 * spread );

  for ( let i = 0; i < 4000; i++ ) {
    const angle = rng() * Math.PI * 2;
    const radius = minR + rng() * ( maxR - minR );
    const col = Math.round( around.col + Math.cos( angle ) * radius );
    const row = Math.round( around.row + Math.sin( angle ) * radius );

    if ( cellChar(
      col,
      row,
      seed,
      alphabet
    ) === ch ) {
      return {
        col,
        row
      };
    }
  }

  // Deterministic outward ring scan — guarantees a hit if one exists anywhere.
  for ( let ring = Math.ceil( minR ); ring < minR + 512; ring++ ) {
    for ( let k = 0; k <= ring * 8; k++ ) {
      const angle = ( k / ( ring * 8 + 1 ) ) * Math.PI * 2;
      const col = Math.round( around.col + Math.cos( angle ) * ring );
      const row = Math.round( around.row + Math.sin( angle ) * ring );

      if ( cellChar(
        col,
        row,
        seed,
        alphabet
      ) === ch ) {
        return {
          col,
          row
        };
      }
    }
  }

  return {
    col: around.col + Math.round( viewRadius * 2 ),
    row: around.row,
    forced: ch
  };
}

// One target cell per word glyph, chained so each is found outside the previous
// one's viewport.
export function buildPath( {
  glyphs,
  seed,
  alphabet,
  viewRadius,
  spread
} ) {
  if ( glyphs.length === 0 ) {
    return [];
  }

  const rng = mulberry32( Math.imul(
    seed + 1,
    2654435761
  ) >>> 0 );
  const path = [];
  let around = {
    col: 0,
    row: 0
  };

  glyphs.forEach( (
    ch, index
  ) => {
    const cell = findCellFor( {
      ch,
      around,
      rng,
      seed,
      alphabet,
      viewRadius,
      spread,
      near: index === 0
    } );

    path.push( {
      col: cell.col,
      row: cell.row,
      char: ch,
      forced: cell.forced ?? null
    } );
    around = cell;
  } );

  return path;
}

/**
 * Where the reading head sits this frame. `progression` (0→1, looping) maps to a
 * segment of the path: the camera rests on the current letter for `dwell` of the
 * step, then eases on to the next. Returns the camera position in cell space plus
 * which word cell is currently "lit" (and by how much) so the caller can light /
 * raise it. Pure: pass `progression` and `easeFn` in.
 */
export function resolveReadingPosition( {
  path,
  progression,
  dwell = 0.45,
  easeFn = ( x ) => x
} ) {
  if ( !path || path.length === 0 ) {
    return {
      camCol: 0,
      camRow: 0,
      index: -1,
      next: -1,
      from: null,
      to: null,
      fromLit: 0,
      toLit: 0,
      local: 0,
      eased: 0
    };
  }

  if ( path.length === 1 ) {
    return {
      camCol: path[ 0 ].col,
      camRow: path[ 0 ].row,
      index: 0,
      next: 0,
      from: path[ 0 ],
      to: path[ 0 ],
      fromLit: 1,
      toLit: 1,
      local: 0,
      eased: 0
    };
  }

  const count = path.length;
  const phase = progression * count;
  const index = Math.floor( phase ) % count;
  const next = ( index + 1 ) % count;
  const frac = phase - Math.floor( phase );

  const clampedDwell = clamp(
    dwell,
    0,
    0.95
  );
  const move = Math.max(
    1e-4,
    1 - clampedDwell
  );
  // 0 while resting on the current letter, ramps 0→1 across the move window.
  const local = clamp(
    ( frac - clampedDwell ) / move,
    0,
    1
  );
  const eased = easeFn( local );

  const from = path[ index ];
  const to = path[ next ];

  return {
    camCol: lerp(
      from.col,
      to.col,
      eased
    ),
    camRow: lerp(
      from.row,
      to.row,
      eased
    ),
    index,
    next,
    from,
    to,
    fromLit: 1 - eased,
    toLit: eased,
    local,
    eased
  };
}

/**
 * Convenience cache wrapper. Owns a `{ key, path, alphabet }` record and rebuilds
 * the path only when the letters' IDENTITY changes. The caller passes the record in
 * so each sketch keeps its own (the engine resets between sketches).
 *
 * The cache key is INTENTIONALLY limited to what actually decides which glyphs are
 * on screen — the word, the resolved alphabet and the seed. Everything the camera
 * lands on is `cellChar(col, row, seed, alphabet)`, so the letters only *look* like
 * they change when the path (hence the camera's absolute cell coordinates) moves.
 * Keeping viewRadius / spread OUT of the key freezes the letters against zoom, cell
 * size, breathing zoom, view radius, search spread and every other purely visual or
 * motion control: change any of them and the same letters stay put — which is what
 * lets them be driven by the binding system and dynamic montage without the field
 * reshuffling underfoot (a per-frame breathing zoom used to rebuild the path every
 * frame). viewRadius / spread still SHAPE a freshly built path — they just never
 * trigger one; the layout re-forms only when the word, alphabet or seed changes.
 */
export function ensurePath(
  store, {
    wordCfg,
    spread,
    viewRadius
  }
) {
  const glyphs = wordGlyphs( wordCfg.value );
  const alphabet = buildAlphabet(
    wordCfg,
    glyphs
  );
  const seed = Math.round( wordCfg.seed ?? 1 );
  const key = [
    glyphs.join( "" ),
    alphabet,
    seed
  ].join( "|" );

  if ( key !== store.key ) {
    store.key = key;
    store.alphabet = alphabet;
    store.seed = seed;
    store.path = buildPath( {
      glyphs,
      seed,
      alphabet,
      viewRadius,
      spread
    } );
  }

  return store;
}
