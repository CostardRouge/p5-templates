import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import string from "@/p5/utils/string.js";
import {
  splitContours,
  resampleContour
} from "@/p5/utils/letterPaths.js";
import {
  flipBeat,
  mod,
  hash2,
  valueNoise
} from "../_shared.js";

// ─────────────────────────────────────────────────────────────────────────────
// flip v2 — grid cascade.
//
// v1 turns one plane and changes the letter on the frame where it is edge-on.
// v2 takes that rule and asks what else may change on that frame — and the
// answer is: the number of cells. A tile turns, goes flat, and COMES BACK AS
// TWO. Then four, then eight. The subdivision is not an effect layered on the
// flip; it is the same event, seen from the other side.
//
// ── Two layouts, one clock ──────────────────────────────────────────────────
// `layout.mode = fixed` is a plain columns × rows board — two dumb numbers you
// can drive from anywhere, because nothing about them has to land on a flat
// frame. `layout.mode = subdivide` is the cascade, and the sketch owns it,
// because a split that lands anywhere but edge-on is a visible seam.
//
// ── Why the tree is rebuilt every frame ─────────────────────────────────────
// The obvious implementation keeps the tree in state and mutates it when a
// tile goes flat. That version cannot be captured: a headless render starts on
// an arbitrary frame and would inherit a different tree, and frame 0 would not
// match frame N. So the tree here is a PURE FUNCTION of the loop clock —
// walked from the root every frame, each node deriving its own beat from its
// own rectangle. It still changes only on flat frames, because the value it
// derives (`generationAt( its own beat index )`) only changes when that index
// does, which is exactly when the node is edge-on.
//
// ── The wavefront ───────────────────────────────────────────────────────────
// Every cell gets a `rank` in [0,1] — by column, row, diagonal, radius, noise
// or hash — and the beat clock sweeps those ranks: when the front reaches your
// rank, you turn. One mechanism covers the clean curtain, the random sparkle
// and the noise blobs, and `wave.head` exposes the front's position as a plain
// scalar, so an interaction binding can drive the whole board by hand.
//
// A consequence worth knowing rather than fighting: children take their rank
// from their own rectangle, so with a SPATIALLY SMOOTH order (columns, rows,
// radial) a child's phase is within a hair of its parent's and the split is
// invisible; with `random`, `noise` or a high `jitter`, children appear at an
// arbitrary angle the instant the parent vanishes. That is the anime cut-in,
// and it is the same knob as the chaos — not a separate mode.
//
// ── Why this does not raymarch ──────────────────────────────────────────────
// v1's SDF holds 8 glyph planes at 48 capsules each. A board of 64 independent
// planes would unroll to tens of thousands of capsule evaluations per scene
// sample; GLSL ES 1.00 also forbids picking a letter's uniform slice by a
// uniform-derived index, so every cell would have to loop the whole bank. So
// each entry is baked ONCE into a card (the same capsule-chain tube look,
// rasterised in 2D) and the board is that card on turning quads in an
// offscreen WEBGL buffer — the text-dice pattern. Cells are then free.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FACES = 12; // cards resident at once (the cycle, or its letters)
const MAX_DEPTH = 6; // 2^6 = 64 tiles, the ceiling the depth slider clamps to
const BUILD_SIZE = 100; // glyph sampling size, as in v1
const CARD_MAX = 512; // card texture side, px
const CARD_MIN = 128;
const CARD_CACHE_MAX = 16;

// Per-instance: p5.Graphics belong to one p5 instance, and a "sketch" content
// item runs this module as a layer beside the page that may also be running
// it. Sharing either the scene buffer or the card cache between them is the
// bug instanceState.js exists to prevent.
const state = sketch.state( () => ( {
  scene: null,
  cards: new Map(),
  cardOrder: []
} ) );

// ── Cards ────────────────────────────────────────────────────────────────────

function disposeGraphics( g ) {
  try {
    g?.remove?.();
  } catch {
    // A graphic whose p5 instance is already torn down throws on remove; it is
    // going to be collected either way.
  }
}

function resetGraphics() {
  for ( const card of state.cards.values() ) {
    disposeGraphics( card );
  }

  state.cards.clear();
  state.cardOrder = [];
  disposeGraphics( state.scene );
  state.scene = null;
}

// Bake one face — a letter or a whole word — as a chain of round-capped
// capsules, the 2D reading of v1's tube SDF. Two passes: a wide dark body and
// a narrower bright core, which is what makes a flat stroke read as a tube.
// The hue varies ALONG the path and never with time: a time-varying hue would
// mean re-baking every frame, so animated colour rides the per-cell tint
// instead.
function bakeCard(
  p, spec
) {
  const font = string.fonts[ spec.font ] ?? string.fonts.sans;

  if ( !font?.font || !spec.text.length ) {
    return null;
  }

  const contours = [];
  const sampleStep = Math.max(
    1,
    spec.spacing * BUILD_SIZE
  );

  p.push();
  p.textFont( font );
  p.textSize( BUILD_SIZE );

  let pen = 0;

  for ( const char of spec.text ) {
    const advance = p.textWidth( char );

    if ( char.trim() === "" ) {
      pen += advance;
      continue;
    }

    const raw = font.textToPoints(
      char,
      pen,
      0,
      BUILD_SIZE,
      {
        sampleFactor: spec.detail,
        simplifyThreshold: spec.simplify
      }
    );

    pen += advance;

    if ( !raw.length ) {
      continue;
    }

    for ( const pts of splitContours(
      raw,
      0.2 * BUILD_SIZE
    ) ) {
      const resampled = resampleContour(
        pts,
        sampleStep,
        true
      );

      if ( resampled.length >= 2 ) {
        contours.push( resampled );
      }
    }
  }

  p.pop();

  if ( !contours.length ) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for ( const contour of contours ) {
    for ( const pt of contour ) {
      minX = Math.min(
        minX,
        pt.x
      );
      maxX = Math.max(
        maxX,
        pt.x
      );
      minY = Math.min(
        minY,
        pt.y
      );
      maxY = Math.max(
        maxY,
        pt.y
      );
    }
  }

  const g = p.createGraphics(
    spec.size,
    spec.size
  );

  g.clear();
  g.colorMode(
    g.HSB,
    360,
    100,
    100,
    100
  );
  g.noFill();
  g.strokeCap( g.ROUND );

  // Fit the face inside the card, leaving room for half a stroke on each side
  // so the thickest tube never clips against the card's edge.
  const tube = spec.thickness * spec.size;
  const pad = tube * 0.6 + spec.size * 0.04;
  const boxW = Math.max(
    maxX - minX,
    1e-3
  );
  const boxH = Math.max(
    maxY - minY,
    1e-3
  );
  const scale = Math.min(
    ( spec.size - pad * 2 ) / boxW,
    ( spec.size - pad * 2 ) / boxH
  ) * spec.fill;
  const offsetX = spec.size / 2 - ( minX + boxW / 2 ) * scale;
  const offsetY = spec.size / 2 - ( minY + boxH / 2 ) * scale;

  let total = 0;

  for ( const contour of contours ) {
    total += contour.length;
  }

  const passes = [
    {
      weight: tube,
      sat: spec.saturation,
      bri: 46
    },
    {
      weight: tube * 0.42,
      sat: spec.saturation * 0.55,
      bri: 100
    }
  ];

  for ( const pass of passes ) {
    g.strokeWeight( Math.max(
      1,
      pass.weight
    ) );

    let walked = 0;

    for ( const contour of contours ) {
      const n = contour.length;

      for ( let i = 0; i < n; i++ ) {
        const a = contour[ i ];
        const b = contour[ ( i + 1 ) % n ];
        const along = total > 1 ? walked / ( total - 1 ) : 0;

        walked++;

        g.stroke(
          mod(
            spec.hue + along * spec.hueSpread * 360,
            360
          ),
          pass.sat,
          pass.bri * spec.brightness,
          100
        );
        g.line(
          a.x * scale + offsetX,
          a.y * scale + offsetY,
          b.x * scale + offsetX,
          b.y * scale + offsetY
        );
      }
    }
  }

  return g;
}

function getCard(
  p, spec
) {
  const font = string.fonts[ spec.font ] ?? string.fonts.sans;
  const family = font?.font?.names?.fontFamily?.en || "unknown";
  const key = [
    spec.text,
    family,
    spec.detail,
    spec.simplify,
    spec.spacing,
    spec.thickness,
    spec.fill,
    spec.hue,
    spec.hueSpread,
    spec.saturation,
    spec.brightness,
    spec.size
  ].join( "|" );

  const cached = state.cards.get( key );

  if ( cached ) {
    return cached;
  }

  const card = bakeCard(
    p,
    spec
  );

  // Font still loading — don't cache the miss, retry next frame.
  if ( !card ) {
    return null;
  }

  state.cards.set(
    key,
    card
  );
  state.cardOrder.push( key );

  while ( state.cardOrder.length > CARD_CACHE_MAX ) {
    const oldest = state.cardOrder.shift();

    disposeGraphics( state.cards.get( oldest ) );
    state.cards.delete( oldest );
  }

  return card;
}

// ── The board ────────────────────────────────────────────────────────────────

// Where a cell sits in the turn order. Spatially smooth kinds make the
// subdivision invisible; random and noise make it a cut (see the header).
function rankAt(
  cx, cy, wave
) {
  let r;

  switch ( wave.order ) {
    case "all":
      r = 0;
      break;
    case "columns":
      r = cx;
      break;
    case "rows":
      r = cy;
      break;
    case "diagonal":
      r = ( cx + cy ) / 2;
      break;
    case "radial":
      r = Math.min(
        1,
        Math.hypot(
          cx - 0.5,
          cy - 0.5
        ) / 0.7072
      );
      break;
    case "noise":
      r = valueNoise(
        cx,
        cy,
        wave.seed,
        wave.frequency
      );
      break;
    default:
      r = hash2(
        cx * 997,
        cy * 991,
        wave.seed
      );
  }

  if ( wave.jitter > 0 ) {
    r += ( hash2(
      cx * 733 + 11,
      cy * 739 + 17,
      wave.seed + 3
    ) - 0.5 ) * wave.jitter * 1.6;
  }

  return Math.max(
    0,
    Math.min(
      r,
      1
    )
  );
}

// How far this cell's generation runs ahead of or behind the board's. This is
// the ragged quadtree: at 0 the board is a clean power of two, at 1 a big tile
// sits next to a tiny one.
function scatterAt(
  cx, cy, sub
) {
  if ( sub.scatter <= 0 ) {
    return 0;
  }

  const s = hash2(
    cx * 613 + 3,
    cy * 617 + 5,
    sub.seed
  );

  return Math.round( ( s - 0.5 ) * 2 * sub.scatter * 2.4 );
}

// The board's generation at a whole beat. `grow` climbs and drops back,
// `pingPong` climbs and unwinds — both return to 0 after `schedulePeriod`
// beats, which is what lets the loop close.
function generationAt(
  beatIndex, sub
) {
  const step = Math.floor( beatIndex / sub.rate );

  if ( sub.schedule === "grow" ) {
    return mod(
      step,
      sub.depth + 1
    );
  }

  const period = Math.max(
    1,
    sub.depth * 2
  );
  const k = mod(
    step,
    period
  );

  return k <= sub.depth ? k : period - k;
}

function schedulePeriod( sub ) {
  return sub.rate * ( sub.schedule === "grow"
    ? sub.depth + 1
    : Math.max(
      1,
      sub.depth * 2
    ) );
}

function gcd(
  a, b
) {
  return b === 0 ? a : gcd(
    b,
    a % b
  );
}

// Walk the tree from the root, emitting the leaves that are on stage at this
// clock. Nothing is stored between frames: every node re-derives its own beat
// from its own rectangle, so the whole board is a function of `beats`.
function collectTiles(
  x, y, w, h, depth, beats, cfg, out
) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rank = rankAt(
    cx,
    cy,
    cfg.wave
  );
  const rogue = cfg.rogue > 0 && hash2(
    cx * 409 + 71,
    cy * 419 + 73,
    cfg.wave.seed + 9
  ) < cfg.rogue;
  const phase = ( beats - rank * cfg.wave.spread ) * ( rogue ? 2 : 1 );
  const beat = flipBeat(
    phase,
    cfg.hold,
    cfg.easeFn,
    cfg.overshoot
  );

  if ( depth < MAX_DEPTH ) {
    const target = Math.max(
      0,
      Math.min(
        cfg.sub.depth,
        generationAt(
          beat.index,
          cfg.sub
        ) + scatterAt(
          cx,
          cy,
          cfg.sub
        )
      )
    );

    if ( depth < target ) {
      // Alternating cut: a tile that swings about its vertical axis splits
      // left/right, one that tumbles splits top/bottom — which is what turns
      // 1 → 2 → 4 → 8 instead of 1 → 4 → 16.
      if ( depth % 2 === 0 ) {
        collectTiles(
          x,
          y,
          w / 2,
          h,
          depth + 1,
          beats,
          cfg,
          out
        );
        collectTiles(
          x + w / 2,
          y,
          w / 2,
          h,
          depth + 1,
          beats,
          cfg,
          out
        );
      } else {
        collectTiles(
          x,
          y,
          w,
          h / 2,
          depth + 1,
          beats,
          cfg,
          out
        );
        collectTiles(
          x,
          y + h / 2,
          w,
          h / 2,
          depth + 1,
          beats,
          cfg,
          out
        );
      }

      return out;
    }
  }

  out.push( {
    x,
    y,
    w,
    h,
    depth,
    cx,
    cy,
    rank,
    rogue,
    index: beat.index,
    turn: beat.turn,
    u: beat.u
  } );

  return out;
}

function fixedTiles(
  columns, rows, beats, cfg, out
) {
  for ( let iy = 0; iy < rows; iy++ ) {
    for ( let ix = 0; ix < columns; ix++ ) {
      const w = 1 / columns;
      const h = 1 / rows;
      const x = ix * w;
      const y = iy * h;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rank = rankAt(
        cx,
        cy,
        cfg.wave
      );
      const rogue = cfg.rogue > 0 && hash2(
        cx * 409 + 71,
        cy * 419 + 73,
        cfg.wave.seed + 9
      ) < cfg.rogue;
      const beat = flipBeat(
        ( beats - rank * cfg.wave.spread ) * ( rogue ? 2 : 1 ),
        cfg.hold,
        cfg.easeFn,
        cfg.overshoot
      );

      out.push( {
        x,
        y,
        w,
        h,
        depth: ix % 2,
        cx,
        cy,
        rank,
        rogue,
        index: beat.index,
        turn: beat.turn,
        u: beat.u
      } );
    }
  }

  return out;
}

// ── Scene buffer ─────────────────────────────────────────────────────────────

// Recreate the offscreen WEBGL buffer when the canvas resizes — or when it
// belongs to a previous p5 instance (a re-mount, HMR, a layer swapped out),
// since drawing with a torn-down instance's graphic is what crashes p5.
function ensureScene( p ) {
  const sameInstance = state.scene?._pInst === p;

  if (
    !state.scene
    || !sameInstance
    || state.scene.width !== p.width
    || state.scene.height !== p.height
  ) {
    if ( sameInstance ) {
      disposeGraphics( state.scene );
    }

    state.scene = p.createGraphics(
      p.width,
      p.height,
      p.WEBGL
    );
  }

  return state.scene;
}

sketch.setup( () => {
  const p = getP5();

  resetGraphics();
  ensureScene( p );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const layout = o.layout ?? {};
  const flip = o.flip ?? {};
  const wave = o.wave ?? {};
  const content = o.content ?? {};
  const cell = o.cell ?? {};
  const colors = o.colors ?? {};
  const camera = o.camera ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  // ── The faces on stage ────────────────────────────────────────────────────
  // One flat list, whatever the content mode asks for: the entries themselves,
  // or every letter of every entry when the board is spelling.
  const entries = ( Array.isArray( textCfg.words ) ? textCfg.words : [
    textCfg.words
  ] )
    .map( ( entry ) => ( entry ?? "" ).toString().trim() )
    .filter( ( entry ) => entry.length > 0 );

  if ( !entries.length ) {
    return;
  }

  const mode = content.mode ?? "scatter";
  const faces = ( mode === "spell"
    ? entries.join( "" ).split( "" )
    : entries ).slice(
    0,
    MAX_FACES
  );

  const cardSize = Math.round( Math.min(
    CARD_MAX,
    Math.max(
      CARD_MIN,
      p.width / 2
    )
  ) );
  const cards = faces.map( (
    text, i
  ) => getCard(
    p,
    {
      text,
      font: textCfg.font ?? "martian",
      detail: textCfg.detail ?? 0.6,
      simplify: textCfg.simplify ?? 0,
      spacing: textCfg.spacing ?? 0.06,
      thickness: textCfg.thickness ?? 0.05,
      fill: cell.fill ?? 0.86,
      hue: mod(
        ( colors.huePhase ?? 200 ) + i * ( colors.faceHueShift ?? 40 ),
        360
      ),
      hueSpread: colors.hueSpread ?? 0.6,
      saturation: colors.saturation ?? 55,
      brightness: colors.brightness ?? 1,
      size: cardSize
    }
  ) );

  // Font still loading, or an entry with no renderable glyph — wait rather
  // than show a board with holes in it.
  if ( cards.some( ( card ) => !card ) ) {
    return;
  }

  const faceCount = cards.length;

  // ── The clock ─────────────────────────────────────────────────────────────
  const t = animation.angle;
  const loopProgress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const headMode = wave.headMode ?? "clock";
  const progress = headMode === "manual"
    ? Math.max(
      0,
      Math.min(
        wave.head ?? 0,
        1
      )
    )
    : loopProgress;

  const subdividing = ( layout.mode ?? "subdivide" ) === "subdivide";
  const sub = {
    depth: Math.max(
      0,
      Math.min(
        Math.round( layout.depth ?? 4 ),
        MAX_DEPTH
      )
    ),
    rate: Math.max(
      1,
      Math.round( layout.rate ?? 1 )
    ),
    schedule: layout.schedule ?? "pingPong",
    scatter: Math.max(
      0,
      Math.min(
        layout.scatter ?? 0.35,
        1
      )
    ),
    seed: Math.round( wave.seed ?? 7 )
  };

  // Beats per loop. The board's generation returns to 0 every
  // `schedulePeriod` beats and the face cycle every `faceCount`, so the loop
  // closes on their least common multiple — snapping it here is what keeps
  // frame 0 identical to frame N without asking anyone to do the arithmetic.
  const period = subdividing ? schedulePeriod( sub ) : 1;
  const beatsPerPass = period * faceCount / gcd(
    period,
    faceCount
  );
  const cycles = Math.max(
    1,
    Math.round( flip.cycles ?? 1 )
  );
  const beats = progress * beatsPerPass * cycles;

  const easeKey = flip.easing ?? "easeInOutCubic";
  const cfg = {
    hold: Math.max(
      0,
      Math.min(
        flip.hold ?? 0.2,
        0.95
      )
    ),
    overshoot: Math.max(
      0,
      Math.min(
        flip.overshoot ?? 0.35,
        1
      )
    ),
    easeFn: typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x,
    rogue: Math.max(
      0,
      Math.min(
        flip.rogue ?? 0,
        0.5
      )
    ),
    sub,
    wave: {
      order: wave.order ?? "columns",
      spread: Math.max(
        0,
        Math.min(
          wave.spread ?? 0.6,
          2
        )
      ),
      jitter: Math.max(
        0,
        Math.min(
          wave.jitter ?? 0.2,
          1
        )
      ),
      frequency: Math.max(
        1,
        Math.round( wave.frequency ?? 4 )
      ),
      seed: sub.seed
    }
  };

  const tiles = subdividing
    ? collectTiles(
      0,
      0,
      1,
      1,
      0,
      beats,
      cfg,
      []
    )
    : fixedTiles(
      Math.max(
        1,
        Math.round( layout.columns ?? 4 )
      ),
      Math.max(
        1,
        Math.round( layout.rows ?? 3 )
      ),
      beats,
      cfg,
      []
    );

  // ── Camera ────────────────────────────────────────────────────────────────
  const g = ensureScene( p );
  const margin = Math.max(
    0,
    Math.min(
      camera.margin ?? 0.08,
      0.6
    )
  );
  const boardW = p.width * ( 1 - margin );
  const boardH = p.height * ( 1 - margin );
  const fov = ( camera.fov ?? 45 ) * Math.PI / 180;
  const aspect = p.width / Math.max(
    p.height,
    1
  );
  const halfFov = Math.tan( fov / 2 );
  const distance = Math.max(
    boardH / 2 / halfFov,
    boardW / 2 / ( halfFov * aspect )
  ) * ( camera.pullBack ?? 1 );
  const azimuth = camera.azimuth ?? 0;
  const elevation = camera.elevation ?? 0;
  const depthSpread = ( cell.depth ?? 0 ) * boardH * 0.5;

  g.clear();
  g.push();
  g.noStroke();
  g.perspective(
    fov,
    aspect,
    Math.max(
      1,
      distance * 0.02
    ),
    distance + boardW + depthSpread * 2 + 1000
  );
  g.camera(
    distance * Math.cos( elevation ) * Math.sin( azimuth ),
    -distance * Math.sin( elevation ),
    distance * Math.cos( elevation ) * Math.cos( azimuth ),
    0,
    0,
    0,
    0,
    1,
    0
  );

  // ── The tiles ─────────────────────────────────────────────────────────────
  // The cards carry alpha, and WebGL's depth test does not sort transparency,
  // so the board is painted far to near instead. Cells of one generation never
  // overlap; only cell.depth can make them, and this is what handles it.
  const drawable = tiles.map( ( tile ) => {
    const z = depthSpread * ( tile.rank - 0.5 );

    return {
      tile,
      z
    };
  } );

  drawable.sort( (
    a, b
  ) => a.z - b.z );

  const axisMode = flip.axis ?? "follow";
  const counterSpin = Math.max(
    0,
    Math.min(
      flip.counterSpin ?? 0,
      1
    )
  );
  const gutter = Math.max(
    0,
    Math.min(
      cell.gutter ?? 0.06,
      0.6
    )
  );
  const trail = Math.max(
    0,
    Math.min(
      cell.trail ?? 0.5,
      1
    )
  );
  const cellHueShift = colors.cellHueShift ?? 40;
  const hueSpeed = Math.round( colors.hueSpeed ?? 0 );
  const fog = Math.max(
    0,
    Math.min(
      camera.fog ?? 0,
      1
    )
  );

  for ( const {
    tile, z
  } of drawable ) {
    // Which way this tile turns. "follow" ties the turn to the cut that made
    // the tile, so a cell always flips about the axis it was split along.
    let horizontal;

    if ( axisMode === "x" ) {
      horizontal = true;
    } else if ( axisMode === "y" ) {
      horizontal = false;
    } else if ( axisMode === "random" ) {
      horizontal = hash2(
        tile.cx * 131 + 9,
        tile.cy * 137 + 4,
        cfg.wave.seed + 21
      ) < 0.5;
    } else if ( axisMode === "checker" ) {
      horizontal = mod(
        Math.floor( tile.cx * 8 ) + Math.floor( tile.cy * 8 ),
        2
      ) === 1;
    } else {
      horizontal = tile.depth % 2 === 1;
    }

    const spin = counterSpin > 0 && hash2(
      tile.cx * 311 + 1,
      tile.cy * 313 + 2,
      cfg.wave.seed + 33
    ) < counterSpin
      ? -1
      : 1;
    const angle = tile.turn * spin * Math.PI / 2;

    // Which face. `chorus` shows one thing everywhere, `scatter` offsets the
    // cycle per cell, `spell` marches the word across the board.
    const cellSeed = Math.round( hash2(
      tile.cx * 251 + 13,
      tile.cy * 257 + 19,
      cfg.wave.seed + 5
    ) * 1000 );
    let faceIndex;

    if ( mode === "chorus" ) {
      faceIndex = tile.index;
    } else if ( mode === "spell" ) {
      faceIndex = tile.index + Math.round( tile.cy * 64 ) + Math.round( tile.cx * 8 );
    } else {
      faceIndex = tile.index + Math.round( cellSeed * ( content.offset ?? 1 ) );
    }

    const card = cards[ mod(
      faceIndex,
      faceCount
    ) ];

    // Geometry: the cell's rectangle on the board, inset by the gutter.
    const inset = gutter * Math.min(
      tile.w * boardW,
      tile.h * boardH
    ) * 0.5;
    const cw = Math.max(
      1,
      tile.w * boardW - inset * 2
    );
    const ch = Math.max(
      1,
      tile.h * boardH - inset * 2
    );
    const px = ( tile.x + tile.w / 2 - 0.5 ) * boardW;
    const py = ( tile.y + tile.h / 2 - 0.5 ) * boardH;

    // Colour: the card carries a static hue along its own path, and the tint
    // multiplies an animated, per-cell one over it. Edge-on dims, a fresh flip
    // glows, distance fades.
    const cos = Math.abs( Math.cos( angle ) );
    const since = mod(
      tile.u,
      1
    );
    const glow = trail * Math.max(
      0,
      1 - since * 3
    );
    // On `progress`, not on the loop clock: in manual mode the whole sketch
    // has to stay a pure function of the one scalar being driven, or the
    // palette keeps moving under a board that is being held still.
    const hue = mod(
      tile.rank * cellHueShift + hueSpeed * progress * 360 + ( colors.tintPhase ?? 0 ),
      360
    );
    const level = ( 0.42 + 0.58 * cos + glow * 0.5 ) * Math.exp( -fog * Math.abs( z ) / Math.max(
      boardH,
      1
    ) * 4 );

    g.push();
    g.translate(
      px,
      py,
      z
    );

    if ( horizontal ) {
      g.rotateX( angle );
    } else {
      g.rotateY( angle );
    }

    g.colorMode(
      g.HSB,
      360,
      100,
      100,
      100
    );
    g.tint(
      hue,
      Math.min(
        100,
        cellHueShift > 0 ? 42 : 0
      ),
      Math.min(
        100,
        level * 100
      ),
      100
    );

    if ( content.inherit ) {
      // Fragmentation: every cell samples ITS OWN rectangle of one card
      // spanning the whole board, so subdividing cuts the face into pieces
      // that then turn on their own instead of replacing it.
      //
      // The source rect is inset by the same gutter as the destination, in
      // card pixels. Without that the pieces are drawn smaller than the region
      // they stand for and a glyph at rest never quite reassembles — a seam
      // that is invisible per tile and obvious across the board.
      const sourceInsetX = inset * cardSize / boardW;
      const sourceInsetY = inset * cardSize / boardH;

      g.image(
        card,
        -cw / 2,
        -ch / 2,
        cw,
        ch,
        tile.x * cardSize + sourceInsetX,
        tile.y * cardSize + sourceInsetY,
        Math.max(
          1,
          tile.w * cardSize - sourceInsetX * 2
        ),
        Math.max(
          1,
          tile.h * cardSize - sourceInsetY * 2
        )
      );
    } else {
      // The card is square; keep its aspect inside a cell that is not.
      const fitted = Math.min(
        cw,
        ch
      );

      g.image(
        card,
        -fitted / 2,
        -fitted / 2,
        fitted,
        fitted
      );
    }

    g.pop();
  }

  g.pop();
  p.image(
    g,
    0,
    0
  );
} );
