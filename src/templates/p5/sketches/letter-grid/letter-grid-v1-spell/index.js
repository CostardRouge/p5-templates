import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

// ─────────────────────────────────────────────────────────────────────────────
// letter-grid v1 — "spell"
//
// A VIRTUAL, "infinite" grid of random letters/digits. Each cell's glyph is a
// pure hash of (col, row, seed), so any cell can be queried without ever storing
// the whole grid — only the handful of cells inside the viewport are ever drawn.
//
// The camera lives in *cell space* (a fractional col/row) and travels letter by
// letter to spell a word: for each character it locks onto a random matching cell
// — preferably OUTSIDE the current viewport — and eases across the void to it. The
// glyph under the centre of the screen is the one we're "reading", so it lights up
// via a centre-focus falloff; the cells we actually land on (the word) get an
// accent tint on top. A parametric vignette darkens the edges to keep the eye on
// the middle.
//
// Everything the camera does is a pure function of `animation.progression` and a
// seeded, cached path, so the loop is seamless and recordings are reproducible.
// ─────────────────────────────────────────────────────────────────────────────

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

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

// Deterministic 32-bit hash of a cell coordinate — the engine behind the
// "infinite" grid. Same (col, row, seed) always yields the same glyph.
function cellHash(
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

function cellChar(
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
function mulberry32( seed ) {
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

function resolveAlphabet( cfg ) {
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
function wordGlyphs( value ) {
  return [
    ...( value ?? "" ).toUpperCase()
  ].filter( ( ch ) => /\S/.test( ch ) );
}

// Find a cell whose glyph is `ch`, in an annulus around `around`. For the very
// first letter we look CLOSE to the origin (the camera boots already sitting on
// it); for the rest we look BEYOND the viewport so the travel crosses unseen
// territory. Falls back to a deterministic outward scan, then to overriding a far
// cell, so a match is always returned.
function findCellFor( {
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
  // The first letter just needs SOME real cell near the origin (the camera centres
  // on it on boot, so its absolute position is invisible) — search a disk wide
  // enough to reliably hold the glyph. Later letters sit beyond the viewport.
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
// one's viewport. Cached on the inputs that change it.
function buildPath( {
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

function lerp(
  a, b, t
) {
  return a + ( b - a ) * t;
}

// Per-channel lerp between two RGBA arrays → a fresh [r, g, b, a].
function lerpColor(
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

// Cached layout/path, rebuilt only when an input that shapes it changes.
const state = {
  key: "",
  path: [],
  alphabet: LETTERS
};

function ensurePath( {
  wordCfg,
  spread,
  viewRadius
} ) {
  const baseAlphabet = resolveAlphabet( wordCfg );
  const glyphs = wordGlyphs( wordCfg.value );

  // Make sure every glyph the word needs actually lives in the grid, even under
  // a restrictive alphabet (e.g. digits-only) — otherwise the search can't land.
  const alphabet = [
    ...new Set( [
      ...baseAlphabet,
      ...glyphs
    ] )
  ].join( "" );

  const seed = Math.round( wordCfg.seed ?? 1 );
  const key = [
    glyphs.join( "" ),
    alphabet,
    seed,
    Math.round( viewRadius * 100 ),
    Math.round( spread * 100 )
  ].join( "|" );

  if ( key === state.key ) {
    return;
  }

  state.key = key;
  state.alphabet = alphabet;
  state.path = buildPath( {
    glyphs,
    seed,
    alphabet,
    viewRadius,
    spread
  } );
}

// Radial vignette via the 2D context's native gradient — cheap and crisp.
function drawVignette( {
  amount,
  radius,
  softness,
  color
} ) {
  if ( amount <= 0 ) {
    return;
  }

  const p = getP5();
  const ctx = p.drawingContext;
  const cx = p.width / 2;
  const cy = p.height / 2;
  const maxR = 0.5 * Math.sqrt( p.width * p.width + p.height * p.height );
  const inner = clamp(
    radius,
    0,
    1
  ) * maxR;
  const outer = Math.max(
    inner + 1,
    ( radius + Math.max(
      0.01,
      softness
    ) ) * maxR
  );

  const [
    r,
    g,
    b
  ] = color;
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    inner,
    cx,
    cy,
    outer
  );

  gradient.addColorStop(
    0,
    `rgba(${ r }, ${ g }, ${ b }, 0)`
  );
  gradient.addColorStop(
    1,
    `rgba(${ r }, ${ g }, ${ b }, ${ clamp(
      amount,
      0,
      1
    ) })`
  );

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(
    0,
    0,
    p.width,
    p.height
  );
  ctx.restore();
}

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  const wordCfg = o.word ?? {};
  const gridCfg = o.grid ?? {};
  const motionCfg = o.motion ?? {};
  const colorsCfg = o.colors ?? {};
  const vignetteCfg = o.vignette ?? {};

  const background = o.backgroundColor ?? [
    8,
    8,
    12,
    255
  ];

  p.clear();
  p.background( ...background );

  // ── Zoom / cell geometry ──────────────────────────────────────────────────
  // A fractional `cellsAcross` is what leaves the centre glyph big while letting
  // its neighbours peek in at the edges (the "imprecise zoom" margin).
  const cellsAcross = Math.max(
    1,
    gridCfg.cellsAcross ?? 3.4
  );
  const minDim = Math.min(
    p.width,
    p.height
  );
  const pulse = ( gridCfg.zoomPulse ?? 0 ) * Math.sin( animation.angle );
  const cellSize = ( minDim / cellsAcross ) * ( 1 + pulse );

  const viewCols = p.width / cellSize;
  const viewRows = p.height / cellSize;
  const viewRadius = 0.5 * Math.sqrt( viewCols * viewCols + viewRows * viewRows );

  const spread = clamp(
    motionCfg.searchSpread ?? 0.6,
    0,
    1
  );

  ensurePath( {
    wordCfg,
    spread,
    viewRadius
  } );

  const path = state.path;
  const alphabet = state.alphabet;

  // ── Camera position in cell space ─────────────────────────────────────────
  let camCol = 0;
  let camRow = 0;
  let from = null;
  let to = null;
  let fromLit = 1;
  let toLit = 0;

  if ( path.length === 1 ) {
    camCol = path[ 0 ].col;
    camRow = path[ 0 ].row;
    from = path[ 0 ];
    to = path[ 0 ];
  } else if ( path.length > 1 ) {
    const count = path.length;
    const phase = animation.progression * count;
    const index = Math.floor( phase ) % count;
    const next = ( index + 1 ) % count;
    const frac = phase - Math.floor( phase );

    const dwell = clamp(
      motionCfg.dwell ?? 0.45,
      0,
      0.95
    );
    const move = Math.max(
      1e-4,
      1 - dwell
    );
    // 0 while resting on the current letter, ramps 0→1 across the move window.
    const local = clamp(
      ( frac - dwell ) / move,
      0,
      1
    );
    const easeFn = easing[ motionCfg.easing ] ?? easing.easeInOutCubic;
    const eased = easeFn( local );

    from = path[ index ];
    to = path[ next ];
    camCol = lerp(
      from.col,
      to.col,
      eased
    );
    camRow = lerp(
      from.row,
      to.row,
      eased
    );
    fromLit = 1 - eased;
    toLit = eased;
  }

  // ── Draw the visible slice of the grid ────────────────────────────────────
  const font = string.fonts[ gridCfg.font ] ?? string.fonts.spaceMonoRegular;

  if ( font?.font && alphabet.length > 0 ) {
    const letterScale = clamp(
      gridCfg.letterScale ?? 0.62,
      0.1,
      1.4
    );

    p.push();
    p.noStroke();
    p.textFont( font );
    p.textSize( cellSize * letterScale );
    p.textAlign(
      p.CENTER,
      p.CENTER
    );

    const gridColor = colorsCfg.gridColor ?? [
      120,
      120,
      135,
      150
    ];
    const focusColor = colorsCfg.focusColor ?? [
      255,
      255,
      255,
      255
    ];
    const accentColor = colorsCfg.accentColor ?? [
      120,
      200,
      255,
      255
    ];
    const focusRadius = Math.max(
      0.3,
      colorsCfg.focusRadius ?? 1.3
    );
    const focusEase = easing[ colorsCfg.focusEasing ] ?? easing.easeOutQuad;

    const colMin = Math.floor( camCol - viewCols / 2 ) - 1;
    const colMax = Math.ceil( camCol + viewCols / 2 ) + 1;
    const rowMin = Math.floor( camRow - viewRows / 2 ) - 1;
    const rowMax = Math.ceil( camRow + viewRows / 2 ) + 1;

    for ( let col = colMin; col <= colMax; col++ ) {
      for ( let row = rowMin; row <= rowMax; row++ ) {
        const sx = p.width / 2 + ( col - camCol ) * cellSize;
        const sy = p.height / 2 + ( row - camRow ) * cellSize;

        const dx = col - camCol;
        const dy = row - camRow;
        const dist = Math.sqrt( dx * dx + dy * dy );
        const focus = focusEase( clamp(
          1 - dist / focusRadius,
          0,
          1
        ) );

        let colorArray = lerpColor(
          gridColor,
          focusColor,
          focus
        );

        // The word cells we actually land on glow in the accent colour, scaled by
        // how "locked-on" we currently are and how central they sit.
        let accentWeight = 0;

        if ( from && col === from.col && row === from.row ) {
          accentWeight = fromLit;
        } else if ( to && col === to.col && row === to.row ) {
          accentWeight = toLit;
        }

        if ( accentWeight > 0 ) {
          colorArray = lerpColor(
            colorArray,
            accentColor,
            accentWeight * ( 0.35 + 0.65 * focus )
          );
        }

        const glyph = ( from && from.forced && col === from.col && row === from.row )
          ? from.forced
          : ( to && to.forced && col === to.col && row === to.row )
            ? to.forced
            : cellChar(
              col,
              row,
              Math.round( wordCfg.seed ?? 1 ),
              alphabet
            );

        p.fill( ...colorArray );
        p.text(
          glyph,
          sx,
          sy
        );
      }
    }

    p.pop();
  }

  drawVignette( {
    amount: vignetteCfg.amount ?? 0.85,
    radius: vignetteCfg.radius ?? 0.42,
    softness: vignetteCfg.softness ?? 0.5,
    color: vignetteCfg.color ?? background
  } );

  renderTitle();
} );
