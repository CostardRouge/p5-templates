import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import string from "@/p5/utils/string.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl,
  lightDirFrom
} from "@/p5/utils/braidShader.js";
import {
  flipBeat,
  mod,
  hash2,
  valueNoise
} from "../_shared.js";
import {
  MAX_LETTERS,
  SEG_STRIDE,
  MAX_TOTAL_SEG,
  getLetterField
} from "../_letterField.js";

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
// ── Why the board is cards on quads, not one raymarch ───────────────────────
// v1's SDF holds 8 glyph planes at 48 capsules each. A board of 64 independent
// planes would unroll to tens of thousands of capsule evaluations per scene
// sample; GLSL ES 1.00 also forbids picking a letter's uniform slice by a
// uniform-derived index, so every cell would have to loop the whole bank. So
// each entry is baked ONCE into a card and the board is that card on turning
// quads in an offscreen WEBGL buffer — the text-dice pattern. Cells are then
// free, however many there are.
//
// `card.renderer` picks what goes on the card, and both draw the same geometry
// — only the material differs. `strokes` rasterises the capsule chain in 2D;
// `shader` runs v1's own material through the offscreen mode of the shared GPU
// renderer, so at rest the board is made of v1's tubes.
//
// `strokes` is the default, because what the shader card cannot do is turn its
// lighting with the tile: it is baked face-on, so a steeply turned tile reads
// as a lit decal rather than a lit tube. flip-v3-tube-cascade raymarches the
// whole board instead and has no such compromise — it is where the material
// belongs. The shader card stays here for the board v3 cannot reach: v3 caps
// at 8 single glyphs because of how it selects a cell's capsules, while a
// baked card costs one bake however deep the subdivision goes.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FACES = 12; // cards resident at once (the cycle, or its letters)
const MAX_DEPTH = 6; // 2^6 = 64 tiles, the ceiling the depth slider clamps to
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

// ── The card shader ──────────────────────────────────────────────────────────
//
// v1's material, reduced to what a card needs: one upright plane holding the
// whole entry, seen straight on. Every letter shares the plane's basis here,
// so the per-letter rotation v1 carries collapses to an offset — which is why
// this is a fraction of v1's shader rather than a copy of it.
const CARD_FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  uniform int   uLetterCount;
  uniform vec3  uLetCtr[${ MAX_LETTERS }];      // letter centre, glyph units
  uniform float uLetRad[${ MAX_LETTERS }];      // bounding radius
  uniform int   uLetSegCount[${ MAX_LETTERS }]; // valid capsules in this slice
  uniform vec4  uSeg[${ MAX_TOTAL_SEG }];       // (ax, ay, bx, by), ${ SEG_STRIDE }/letter
  uniform float uLetScale;
  uniform float uTubeR;
  uniform float uSmoothK;
  uniform float uOrthoSpan;                     // world height the card covers
  uniform float uCamDistance;

  ${ IRIDESCENT_GLSL }

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  float segDist2D(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h);
  }

  float discBound(vec2 q, float lz, float r) {
    float radial = max(length(q) - r, 0.0);

    return sqrt(radial * radial + lz * lz);
  }

  float mapScene(vec3 p) {
    float best = 1e9;
    float kn = max(uSmoothK, 1e-4);

    for (int L = 0; L < ${ MAX_LETTERS }; L++) {
      if (L >= uLetterCount) { break; }

      vec3 rel = p - uLetCtr[L];
      float bound = discBound(rel.xy, rel.z, uLetRad[L]) - uTubeR - kn;

      if (bound > 0.3) { best = min(best, bound); continue; }

      int cnt = uLetSegCount[L];
      float d2 = 1e9;

      for (int s = 0; s < ${ SEG_STRIDE }; s++) {
        if (s >= cnt) { break; }

        vec4 seg = uSeg[L * ${ SEG_STRIDE } + s];

        d2 = smin(d2, segDist2D(rel.xy, seg.xy, seg.zw), kn);
      }

      best = min(best, sqrt(d2 * d2 + rel.z * rel.z) - uTubeR);
    }

    return best * uLetScale;
  }

  float nearestPipe(vec3 p) {
    float best = 1e9;
    float bestL = 0.0;

    for (int L = 0; L < ${ MAX_LETTERS }; L++) {
      if (L >= uLetterCount) { break; }

      vec3 rel = p - uLetCtr[L];
      float d = discBound(rel.xy, rel.z, uLetRad[L]) - uTubeR;

      if (d < best) { best = d; bestL = float(L); }
    }

    return bestL;
  }

  ${ braidShadingGlsl( {
    maxSteps: 72,
    surfEps: 0.0006
  } ) }

  // Orthographic, deliberately: the card becomes a texture on a quad that
  // supplies its own perspective, and a perspective bake would apply it twice.
  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 ro = vec3(uv * uOrthoSpan, -uCamDistance);
    vec3 rd = vec3(0.0, 0.0, 1.0);

    gl_FragColor = traceRay(ro, rd);
  }
`;

const cardRenderer = createNoiseFieldRenderer( CARD_FRAGMENT );

// ── The two card renderers ───────────────────────────────────────────────────
//
// Both draw the SAME geometry — the letter field from ../_letterField.js — so
// switching renderer changes the material and nothing else. That is the whole
// reason the field lives in its own module rather than inside either of them.

// Where the field sits inside a square card: the entry is fitted on its larger
// half-extent so a wide word and a tall letter are framed the same way, and
// `fill` is the margin knob both renderers share.
function cardFit(
  field, fill
) {
  const half = Math.max(
    field.halfW,
    field.halfH,
    1e-3
  );

  return half / Math.max(
    fill,
    0.05
  );
}

// Strokes: each capsule drawn as a round-capped line, twice — a wide dark body
// under a narrow bright core, which is what makes a flat stroke read as a tube.
// Cheap, and it stays legible at the sizes a deep subdivision produces.
//
// The hue varies ALONG the path and never with time: a time-varying hue would
// mean re-baking every frame, so animated colour rides the per-cell tint.
function bakeStrokeCard(
  p, spec, field
) {
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

  const span = cardFit(
    field,
    spec.fill
  );
  const scale = spec.size / ( 2 * span );
  const tube = Math.max(
    1,
    spec.thickness * spec.size
  );

  let total = 0;

  for ( let k = 0; k < field.count; k++ ) {
    total += field.segCount[ k ];
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
    g.strokeWeight( pass.weight );

    let walked = 0;

    for ( let k = 0; k < field.count; k++ ) {
      const ox = field.offsets[ k * 2 ];
      const oy = field.offsets[ k * 2 + 1 ];
      const count = field.segCount[ k ];
      const base = k * SEG_STRIDE * 4;

      for ( let s = 0; s < count; s++ ) {
        const at = base + s * 4;
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

        // Glyph space is y-up and centred on the origin; the card is y-down
        // and centred on its middle.
        g.line(
          spec.size / 2 + ( ox + field.seg[ at ] ) * scale,
          spec.size / 2 - ( oy + field.seg[ at + 1 ] ) * scale,
          spec.size / 2 + ( ox + field.seg[ at + 2 ] ) * scale,
          spec.size / 2 - ( oy + field.seg[ at + 3 ] ) * scale
        );
      }
    }
  }

  return g;
}

// Shader: v1's material, raymarched — real iridescence, specular, ambient
// occlusion and optional cast shadows. The camera is ORTHOGRAPHIC, unlike v1's,
// because the card is a texture that a turning quad will give its own
// perspective to; a perspective bake would apply it twice.
//
// The one thing this cannot do, and it is worth stating rather than
// discovering: the lighting is baked face-on, so it does not turn with the
// tile. Near face-on it is v1 exactly; at a steep angle it reads as a lit
// decal rather than a lit tube. Real per-angle lighting needs the whole board
// raymarched in one pass, which is a different sketch.
function bakeShaderCard(
  p, spec, field
) {
  const span = cardFit(
    field,
    spec.fill
  );
  const reach = spec.tube + spec.fusion;
  const camDistance = span + reach + 1;
  const uniforms = {
    uT: 0,
    uLetterCount: {
      int: field.count
    },
    uSeg: {
      vec4v: field.seg
    },
    uLetSegCount: {
      intv: field.segCount
    },
    uLetRad: {
      floatv: field.radius
    },
    uLetScale: 1,
    uTubeR: Math.max(
      spec.tube,
      1e-3
    ),
    uSmoothK: Math.max(
      spec.fusion,
      1e-3
    ),
    uOrthoSpan: span * 2,
    uCamDistance: camDistance,
    uMaxDist: camDistance * 2 + reach * 2,
    uHueSpeed: 0,
    uHueSpread: spec.hueSpread,
    uHuePhase: spec.hue * Math.PI / 180,
    uLengthHueShift: spec.lengthHueShift,
    uPipeHueShift: spec.letterHueShift,
    uShimmer: spec.shimmer,
    uSaturation: spec.saturation / 100,
    uBrightness: spec.brightness,
    uLightDir: lightDirFrom(
      spec.light.azimuth,
      spec.light.elevation
    ),
    uAmbient: spec.light.ambient,
    uDiffuse: spec.light.diffuse,
    uSpecular: spec.light.specular,
    uSpecPower: spec.light.specPower,
    uFresnelPower: spec.light.fresnelPower,
    uRimStrength: spec.light.rimStrength,
    uShadowSoft: spec.light.shadowSoftness,
    uFogDensity: 0,
    uFogStart: 0
  };

  for ( let k = 0; k < field.count; k++ ) {
    uniforms[ `uLetCtr[${ k }]` ] = [
      field.offsets[ k * 2 ],
      field.offsets[ k * 2 + 1 ],
      0
    ];
  }

  const buffer = cardRenderer.render( {
    columns: 1,
    rows: 1,
    offscreen: {
      width: spec.size,
      height: spec.size
    },
    uniforms
  } );

  // The program can still be compiling on the first frame.
  if ( !buffer ) {
    return null;
  }

  // The renderer's buffer is reused by the next call, so the pixels are copied
  // into a graphic this sketch owns before anything else can bake.
  const g = p.createGraphics(
    spec.size,
    spec.size
  );

  g.clear();
  g.image(
    buffer,
    0,
    0,
    spec.size,
    spec.size
  );

  return g;
}

function getCard(
  p, spec
) {
  const font = string.fonts[ spec.font ] ?? string.fonts.sans;
  const family = font?.font?.names?.fontFamily?.en || "unknown";
  const key = [
    spec.renderer,
    spec.text,
    family,
    spec.detail,
    spec.simplify,
    spec.spacing,
    spec.thickness,
    spec.tube,
    spec.fusion,
    spec.fill,
    spec.hue,
    spec.hueSpread,
    spec.lengthHueShift,
    spec.letterHueShift,
    spec.shimmer,
    spec.saturation,
    spec.brightness,
    spec.size,
    spec.renderer === "shader" ? JSON.stringify( spec.light ) : ""
  ].join( "|" );

  const cached = state.cards.get( key );

  if ( cached ) {
    return cached;
  }

  const field = getLetterField( {
    text: spec.text,
    fontName: spec.font,
    sampleFactor: spec.detail,
    simplifyThreshold: spec.simplify,
    contourBreak: 0.2,
    spacing: spec.spacing
  } );

  // Font still loading — don't cache the miss, retry next frame.
  if ( !field ) {
    return null;
  }

  const card = spec.renderer === "shader"
    ? bakeShaderCard(
      p,
      spec,
      field
    )
    : bakeStrokeCard(
      p,
      spec,
      field
    );

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
  const card = o.card ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
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
      renderer: card.renderer ?? "strokes",
      text,
      font: textCfg.font ?? "martian",
      detail: textCfg.detail ?? 0.6,
      simplify: textCfg.simplify ?? 0,
      spacing: textCfg.spacing ?? 0.06,
      // Strokes measure the tube against the card; the shader measures it
      // against a glyph unit. Same idea, different rulers — which is why they
      // are two fields in two branches rather than one shared slider.
      thickness: card.thickness ?? 0.05,
      tube: card.tube ?? 0.045,
      fusion: card.fusion ?? 0.02,
      fill: cell.fill ?? 0.86,
      hue: mod(
        ( colors.huePhase ?? 200 ) + i * ( colors.faceHueShift ?? 40 ),
        360
      ),
      hueSpread: colors.hueSpread ?? 0.6,
      lengthHueShift: colors.lengthHueShift ?? -0.25,
      letterHueShift: colors.letterHueShift ?? 0.7,
      shimmer: colors.shimmer ?? 2.2,
      saturation: colors.saturation ?? 55,
      brightness: colors.brightness ?? 1,
      light: {
        azimuth: light.azimuth ?? -1.1,
        elevation: light.elevation ?? 0.45,
        ambient: light.ambient ?? 0.48,
        diffuse: light.diffuse ?? 0.56,
        specular: light.specular ?? 1.52,
        specPower: light.specPower ?? 31,
        fresnelPower: light.fresnelPower ?? 1.62,
        rimStrength: light.rimStrength ?? 0,
        shadowSoftness: light.shadowSoftness ?? 0
      },
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
