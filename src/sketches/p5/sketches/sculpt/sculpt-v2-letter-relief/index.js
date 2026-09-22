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
  cameraBasis,
  cameraUniforms,
  screenRay,
  hitPlaneY,
  CAMERA_RIG_UNIFORMS_GLSL,
  CAMERA_RIG_MAIN_GLSL
} from "@/p5/utils/cameraRig.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionCameraPreview
} from "@/p5/utils/interaction/overlay.js";
import {
  buildGrid,
  driftOffsets,
  orderValues,
  computeHeights,
  cursorField,
  linkWeights,
  packBounds,
  packField,
  textUnits,
  valueNoise2,
  MAX_OFFSET,
  HEIGHT_MIN,
  HEIGHT_MAX,
  WEIGHT_MAX
} from "../_mesh.js";

// ─────────────────────────────────────────────────────────────────────────────
// sculpt v2 — letter relief.
//
// v1 scatters its points through a volume and joins them to their nearest
// neighbours; this one lays them out as a SHEET — a jittered grid, where the
// neighbours are implicit and the whole field fits a texture (../_mesh.js).
//
// A sheet of points covers the canvas, joined by the rings family's tubes at
// their thinnest. Under the sheet is a text: each beat, the points that fall
// on the ink of one character RISE — in an order (reading, radial, spiral,
// contour, noise…), with an easing, to a profile — and the tubes between two
// raised points thicken. The letter reads as a relief pushed up from below,
// and the next beat hands over to the next character: everything falls, or
// both move at once, or (the default, `morph`) the points shared by the two
// letters stay up and only the difference moves.
//
// ── Where the logic lives ────────────────────────────────────────────────────
// Everything that DECIDES is CPU-side JavaScript in ../_mesh.js, over typed
// arrays: the grid, the order, the envelope, the links. The shader only reads
// two RGBA8 data textures of one texel per cell — (offset x, offset z, height
// hi, height lo) and (E, S, SE, SW link weights) — and never sees a letter.
// That split is what makes the mechanics unit-testable, and it is what keeps
// a frame a pure function of the loop progression: headless capture renders
// exactly the preview, cursor aside (there is no cursor in capture).
//
// ── The mask is the ink, rasterised ─────────────────────────────────────────
// A character is drawn into an offscreen graphic once (per font, size, weight)
// and a point is "on the ink" if the pixel under its resting position is lit.
// Not the outline chain the rest of the family builds: the counter of an "o"
// is not ink, so its points never rise — the first half of readability. The
// second half is the link rule: a link between two raised points exists only
// if its MIDPOINT is on the ink, so no tube ever bridges a counter or the eye
// of an "e", whatever the neighbourhood (`links.rule`).
//
// ── One SDF for the whole sheet ──────────────────────────────────────────────
// Every cell OWNS four links (east, south, and the two southward diagonals),
// so each link of the grid is stored once. mapScene finds the cell under the
// sample point and traces everything that can touch the 3×3 block around it:
// the nine junction spheres, the nine cells' owned links, and the owned links
// of the outer 5×5 ring whose far end lands in the block (sixteen of them) —
// so every capsule touching the block is traced exactly once, and nothing
// that touches it is missed. Since a point never leaves the middle 90 % of
// its cell (MAX_OFFSET), geometry NOT touching the block is at least one cell
// beyond the sample's own walls, and the step is bounded by that distance:
// a ray never skips into geometry the scan has not seen, and the bound is a
// whole cell, so the march never crawls. The same bound holds on both sides
// of a wall, which is what keeps the field continuous across cells — the
// first version scanned only the 3×3's owned links with a smaller slack, and
// tetrahedron normals straddling a wall read two different fields: every fat
// tube shimmered with noise along the cell boundaries.
// Bounds (the box around the sheet, the cell bound) are combined with plain
// min, never smin: a smooth minimum dips below both operands and would put a
// bound under the hit threshold (the flip-v3 lesson).
//
// ── The air above the sheet is a distance, not a march ──────────────────────
// Everything the block scan traces has its endpoints within two cells of the
// sample, so "the highest point within two cells, plus the widest radius and
// the fillet" is a ceiling: a sample above it is at least that far from
// anything the scan would find, and the scan is skipped for the price of one
// texel (`uBounds`, packed by `packBounds` with the ceiling rounded up and the
// floor rounded down). The lateral cell bound still applies in the air —
// geometry three cells away is beyond the window — and the box itself is the
// frame's real extremes, so on a resting sheet every ray reaches the plane in
// a step or two instead of crawling down through the whole slab, cell by
// cell, with the full scan at every step (540 × 675 under SwiftShader:
// 2466 → 1412 ms a frame, the picture unchanged).
//
// ── The camera is parameters ─────────────────────────────────────────────────
// utils/cameraRig.js: tilt, spin, distance, eye offset, target — one slider
// each, so the binding system can drive any of them, plus whole-cycle motion
// (spin turns, tilt sway, dolly, bob) that closes with the loop. `fit` keeps
// every export framed whatever its aspect. The world is y-up with the sheet in
// the xz plane, so the material's length hue shift becomes a HEIGHT hue shift.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Beats per loop = characters × repeats (whole), drift is a circle of the
// loop clock, hue scroll is whole periods, camera motion is whole cycles:
// progression 1 renders progression 0, cursor lag aside.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 112; // the cell bound shortens steps near the sheet
const MASK_WIDTH = 384; // mask raster width; the height follows the aspect

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }
  ${ CAMERA_RIG_UNIFORMS_GLSL }

  // ── The sheet, one texel per cell ──
  uniform sampler2D uField;      // offset x, offset z (cell units, -1..1), height hi, lo
  uniform sampler2D uLinks;      // E, S, SE, SW link weights (0 = no link)
  uniform vec2  uGrid;           // cols, rows
  uniform vec2  uCell;           // cell size, world (x, z)
  uniform vec2  uHalf;           // sheet half extents, world (x, z)
  uniform float uHeight;         // world units per unit of normalised height
  uniform float uBead;           // junction sphere floor radius, world
  uniform float uTubeRest;       // link radius at rest, world
  uniform float uTubeGain;       // link radius per unit of weight, world
  uniform float uSmoothK;        // smooth-union fillet, world
  uniform float uCellBound;      // one cell: how far past its walls a step may go
  uniform float uSlabTop;        // y above which nothing exists
  uniform float uSlabBottom;     // y below which nothing exists
  uniform sampler2D uBounds;     // per cell: R = highest, G = lowest height within two cells
  uniform float uAirMargin;      // widest radius + fillet + slack, world

  ${ IRIDESCENT_GLSL }

  const float HEIGHT_MIN = ${ HEIGHT_MIN.toFixed( 4 ) };
  const float HEIGHT_RANGE = ${ ( HEIGHT_MAX - HEIGHT_MIN ).toFixed( 4 ) };
  const float WEIGHT_MAX = ${ WEIGHT_MAX.toFixed( 4 ) };
  // Thinner than this is not drawn: anything within the hit threshold of a
  // zero-radius axis would render as a hairline, and a height of 0 decodes
  // from 16 bits to a few 1e-6, not to 0.
  const float MIN_RADIUS = 0.002;
  // An air bound must never read as a surface either: kept above SURF_EPS,
  // and folded into uAirMargin on the CPU so the ceiling stays rigorous.
  const float AIR_SLACK = 0.003;

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  float segDist(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);

    return length(pa - ba * h);
  }

  // A cell's point in world space (xyz) and its normalised height (w).
  vec4 cellData(vec2 ij) {
    vec4 t = texture2D(uField, (ij + 0.5) / uGrid);
    float dx = t.x * 2.0 - 1.0;
    float dz = t.y * 2.0 - 1.0;
    float h = HEIGHT_MIN + ((t.z * 255.0 * 256.0 + t.w * 255.0) / 65535.0) * HEIGHT_RANGE;

    return vec4(
      -uHalf.x + (ij.x + 0.5 + dx) * uCell.x,
      h * uHeight,
      uHalf.y - (ij.y + 0.5 + dz) * uCell.y,
      h
    );
  }

  float linkRadius(float w) {
    return uTubeRest + uTubeGain * w;
  }

  // Byte → weight; a zero byte means no link at all.
  float linkWeight(float byte) {
    return (byte * 255.0 - 1.0) / 254.0 * WEIGHT_MAX;
  }

  // The geometry of cell K = sample cell + (di, dj) that can touch the inner
  // 3×3 block: K's junction sphere when K is in the block, and each of K's
  // owned links when K or the link's far end is in it. Visited over the whole
  // 5×5, this traces every capsule touching the block exactly once.
  float cellDist(vec3 p, vec2 ij, float di, float dj, float d) {
    bool inner = max(abs(di), abs(dj)) <= 1.0;
    bool e = inner || (abs(di + 1.0) <= 1.0 && abs(dj) <= 1.0);
    bool s = inner || (abs(di) <= 1.0 && abs(dj + 1.0) <= 1.0);
    bool se = inner || (abs(di + 1.0) <= 1.0 && abs(dj + 1.0) <= 1.0);
    bool sw = inner || (abs(di - 1.0) <= 1.0 && abs(dj + 1.0) <= 1.0);

    if (!(inner || e || s || se || sw)) { return d; }

    vec4 c = cellData(ij);

    // Geometry thinner than MIN_RADIUS is skipped outright, so a rest mesh
    // weight of 0 or a bead of 0 removes the thing rather than thinning it
    // into specks.
    if (inner) {
      float rJ = max(uBead, linkRadius(max(c.w, 0.0)));

      if (rJ > MIN_RADIUS) { d = smin(d, length(p - c.xyz) - rJ, uSmoothK); }
    }

    vec4 lw = texture2D(uLinks, (ij + 0.5) / uGrid);

    if (e && lw.x > 0.0 && ij.x + 1.0 < uGrid.x) {
      float r = linkRadius(linkWeight(lw.x));

      if (r > MIN_RADIUS) { d = smin(d, segDist(p, c.xyz, cellData(ij + vec2(1.0, 0.0)).xyz) - r, uSmoothK); }
    }

    if (s && lw.y > 0.0 && ij.y + 1.0 < uGrid.y) {
      float r = linkRadius(linkWeight(lw.y));

      if (r > MIN_RADIUS) { d = smin(d, segDist(p, c.xyz, cellData(ij + vec2(0.0, 1.0)).xyz) - r, uSmoothK); }
    }

    if (se && lw.z > 0.0 && ij.x + 1.0 < uGrid.x && ij.y + 1.0 < uGrid.y) {
      float r = linkRadius(linkWeight(lw.z));

      if (r > MIN_RADIUS) { d = smin(d, segDist(p, c.xyz, cellData(ij + vec2(1.0, 1.0)).xyz) - r, uSmoothK); }
    }

    if (sw && lw.w > 0.0 && ij.x - 1.0 >= 0.0 && ij.y + 1.0 < uGrid.y) {
      float r = linkRadius(linkWeight(lw.w));

      if (r > MIN_RADIUS) { d = smin(d, segDist(p, c.xyz, cellData(ij + vec2(-1.0, 1.0)).xyz) - r, uSmoothK); }
    }

    return d;
  }

  float mapScene(vec3 p) {
    // The box holding the whole sheet at every height, one cell of margin.
    vec3 boxHalf = vec3(uHalf.x + uCell.x, (uSlabTop - uSlabBottom) * 0.5, uHalf.y + uCell.y);
    vec3 boxCtr = vec3(0.0, (uSlabTop + uSlabBottom) * 0.5, 0.0);
    vec3 q = abs(p - boxCtr) - boxHalf;
    float boxDist = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

    if (boxDist > uCellBound) { return boxDist; }

    // The cell under p, and the distance to its walls: nothing the scan
    // misses is closer than one cell past them.
    vec2 cellF = vec2((p.x + uHalf.x) / uCell.x, (uHalf.y - p.z) / uCell.y);
    vec2 cellI = clamp(floor(cellF), vec2(0.0), uGrid - 1.0);
    vec2 local = cellF - cellI;
    float wall = min(
      min(local.x, 1.0 - local.x) * uCell.x,
      min(local.y, 1.0 - local.y) * uCell.y
    );
    float bound = max(wall, 0.0) + uCellBound;

    // Above the highest (or below the lowest) point within two cells, the
    // vertical gap is a distance to everything the scan could find; the
    // lateral bound still guards what lies beyond the window.
    vec2 hb = texture2D(uBounds, (cellI + 0.5) / uGrid).xy;
    float airTop = (HEIGHT_MIN + hb.x * HEIGHT_RANGE) * uHeight + uAirMargin;
    float airBottom = (HEIGHT_MIN + hb.y * HEIGHT_RANGE) * uHeight - uAirMargin;

    if (p.y > airTop) { return max(min(p.y - airTop, bound), AIR_SLACK); }
    if (p.y < airBottom) { return max(min(airBottom - p.y, bound), AIR_SLACK); }

    float d = 1e9;

    for (int dj = -2; dj <= 2; dj++) {
      for (int di = -2; di <= 2; di++) {
        vec2 ij = cellI + vec2(float(di), float(dj));

        if (ij.x < 0.0 || ij.y < 0.0 || ij.x >= uGrid.x || ij.y >= uGrid.y) { continue; }

        d = cellDist(p, ij, float(di), float(dj), d);
      }
    }

    // Plain min for the bound: a smooth minimum could pull it under SURF_EPS.
    return min(d, bound);
  }

  // Hue identity: a gradient across the sheet, by cell.
  float nearestPipe(vec3 p) {
    vec2 cellF = vec2((p.x + uHalf.x) / uCell.x, (uHalf.y - p.z) / uCell.y);
    vec2 cellI = clamp(floor(cellF), vec2(0.0), uGrid - 1.0);

    return 0.5 * (cellI.x / uGrid.x + cellI.y / uGrid.y);
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS,
    look: true
  } ) }

  ${ CAMERA_RIG_MAIN_GLSL }
`;

const reliefRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// ── Masks: one raster per unit of text ───────────────────────────────────────
// A unit (a letter, a word, the whole text) is drawn white on black into an
// offscreen graphic sized to the sheet's aspect, then only the red channel is
// kept as bytes. `weight` strokes the text (white to thicken, black over the
// fill to thin). The unit is centred on its INK's bounding box, not on the
// font's metrics — textAlign( CENTER, CENTER ) sits a capital a tenth of the
// sheet too low in agiro — so a glyph lands where the offset says, in any
// font. Memoised by every input, so a beat costs one lookup.
const maskMemo = new Map();
const MASK_MEMO_MAX = 32;

// Bounding box of the lit pixels of a graphic, or null when nothing is lit.
function inkBounds(
  pixels, w, h
) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;

  for ( let y = 0; y < h; y++ ) {
    for ( let x = 0; x < w; x++ ) {
      if ( pixels[ ( y * w + x ) * 4 ] > 127 ) {
        minX = Math.min(
          minX,
          x
        );
        maxX = Math.max(
          maxX,
          x
        );
        minY = Math.min(
          minY,
          y
        );
        maxY = Math.max(
          maxY,
          y
        );
      }
    }
  }

  return maxX < 0 ? null : {
    x: ( minX + maxX ) / 2,
    y: ( minY + maxY ) / 2
  };
}

function rasteriseMask( {
  unit,
  font,
  size,
  weight,
  offset,
  aspect
} ) {
  const p = getP5();
  const mw = MASK_WIDTH;
  const mh = Math.max(
    8,
    Math.round( mw / aspect )
  );
  const g = p.createGraphics(
    mw,
    mh
  );

  g.pixelDensity( 1 );

  const draw = (
    x, y
  ) => {
    g.background( 0 );
    g.fill( 255 );

    if ( weight > 0 ) {
      g.stroke( 255 );
      g.strokeWeight( weight * mh * 0.01 );
    } else {
      g.noStroke();
    }

    g.text(
      unit,
      x,
      y
    );

    if ( weight < 0 ) {
      g.noFill();
      g.stroke( 0 );
      g.strokeWeight( -weight * mh * 0.01 );
      g.text(
        unit,
        x,
        y
      );
    }

    g.loadPixels();
  };

  if ( unit ) {
    g.textFont( font );

    let textSize = size * mh;

    g.textSize( textSize );

    // A word wider than the sheet is shrunk to fit.
    const width = g.textWidth( unit );

    if ( width > mw * 0.92 ) {
      textSize *= ( mw * 0.92 ) / width;
      g.textSize( textSize );
    }

    g.textAlign(
      p.CENTER,
      p.CENTER
    );

    const targetX = mw / 2 + ( offset?.x ?? 0 ) * mw;
    const targetY = mh / 2 + ( offset?.y ?? 0 ) * mh;

    // First pass to find where the ink lands, second pass to put its centre
    // on the target.
    draw(
      targetX,
      targetY
    );

    const centre = inkBounds(
      g.pixels,
      mw,
      mh
    );

    if ( centre ) {
      draw(
        targetX + ( targetX - centre.x ),
        targetY + ( targetY - centre.y )
      );
    }
  } else {
    g.background( 0 );
    g.loadPixels();
  }

  const data = new Uint8Array( mw * mh );

  for ( let i = 0; i < data.length; i++ ) {
    data[ i ] = g.pixels[ i * 4 ];
  }

  // p5.Graphics.remove() frees the GPU side and detaches the canvas, then
  // throws on `_pInst._elements` in this p5 build (text/text-dice hit the same
  // and keeps the same fallback). The canvas is already out of the DOM by
  // then; the fallback covers the path where it is not.
  try {
    g.remove();
  } catch {
    g.canvas?.remove?.();
  }

  return {
    data,
    w: mw,
    h: mh
  };
}

function getMask( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;

  // Font still loading: no mask, no caching of the miss.
  if ( !font?.font ) {
    return null;
  }

  const fontFamily = font.font?.names?.fontFamily?.en || cfg.fontName;
  const key = [
    cfg.unit,
    fontFamily,
    cfg.size,
    cfg.weight,
    cfg.offset?.x ?? 0,
    cfg.offset?.y ?? 0,
    cfg.aspect.toFixed( 4 )
  ].join( "|" );
  const cached = maskMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const mask = {
    key,
    ...rasteriseMask( {
      ...cfg,
      font
    } )
  };

  maskMemo.set(
    key,
    mask
  );

  if ( maskMemo.size > MASK_MEMO_MAX ) {
    maskMemo.delete( maskMemo.keys().next().value );
  }

  return mask;
}

function inkAt(
  mask, u, v
) {
  if ( u < 0 || u >= 1 || v < 0 || v >= 1 ) {
    return 0;
  }

  return mask.data[ ( ( v * mask.h ) | 0 ) * mask.w + ( ( u * mask.w ) | 0 ) ] > 127 ? 1 : 0;
}

// Fraction of eight samples on a circle of radius r (sheet-height units)
// that are on the ink: 1 deep inside a stroke, 0 well outside.
function ringInside(
  mask, u, v, r, aspect
) {
  let inside = 0;

  for ( let k = 0; k < 8; k++ ) {
    const a = ( k * Math.PI ) / 4;

    inside += inkAt(
      mask,
      u + ( Math.cos( a ) * r ) / aspect,
      v + Math.sin( a ) * r
    );
  }

  return inside / 8;
}

// ── Units: the per-point targets and orders of one mask on one grid ──────────
const unitMemo = new Map();
const UNIT_MEMO_MAX = 64;

function buildUnit( {
  mask,
  grid,
  relief,
  rise,
  fall,
  aspect,
  seed
} ) {
  const target = new Float32Array( grid.count );
  const edge = new Float32Array( grid.count );
  const featherR = 0.02 + relief.feather * 0.05;

  for ( let n = 0; n < grid.count; n++ ) {
    const u = grid.u[ n ];
    const v = grid.v[ n ];
    const inside = inkAt(
      mask,
      u,
      v
    );
    const depth = inside
      ? ringInside(
        mask,
        u,
        v,
        relief.domeRadius,
        aspect
      )
      : 0;

    edge[ n ] = depth;

    let base;

    if ( relief.mask === "outline" ) {
      base = inside && ringInside(
        mask,
        u,
        v,
        relief.band,
        aspect
      ) < 1 ? 1 : 0;
    } else {
      base = inside;
    }

    // A soft edge: blend toward the local ink coverage, so a point just
    // outside rises a little and one just inside sits a little lower.
    if ( relief.feather > 0 ) {
      const coverage = ( inside + 8 * ringInside(
        mask,
        u,
        v,
        featherR,
        aspect
      ) ) / 9;

      base += ( coverage - base ) * relief.feather;
    }

    if ( base <= 0.001 ) {
      target[ n ] = 0;
      continue;
    }

    let profile = 1;

    switch ( relief.profile ) {
      case "dome":
        profile = 0.35 + 0.65 * depth;
        break;
      case "ridge":
        profile = 1 - 0.65 * depth;
        break;
      case "noise":
        profile = 0.45 + 0.55 * valueNoise2(
          u * 4 * aspect,
          v * 4,
          seed + 3
        );
        break;
      default:
        profile = 1;
    }

    target[ n ] = base * profile;
  }

  const order = orderValues(
    grid,
    target,
    {
      mode: rise.order,
      angle: rise.angle,
      seed,
      aspect,
      edge
    }
  );
  const fallOrder = fall.order && fall.order !== "mirror"
    ? orderValues(
      grid,
      target,
      {
        mode: fall.order,
        angle: rise.angle,
        seed,
        aspect,
        edge
      }
    )
    : null;

  return {
    target,
    order,
    fallOrder
  };
}

function getUnit( cfg ) {
  const key = [
    cfg.mask.key,
    cfg.gridKey,
    cfg.relief.mask,
    cfg.relief.band,
    cfg.relief.profile,
    cfg.relief.domeRadius,
    cfg.relief.feather,
    cfg.rise.order,
    cfg.rise.angle,
    cfg.fall.order,
    cfg.seed
  ].join( "|" );
  const cached = unitMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const unit = buildUnit( cfg );

  unitMemo.set(
    key,
    unit
  );

  if ( unitMemo.size > UNIT_MEMO_MAX ) {
    unitMemo.delete( unitMemo.keys().next().value );
  }

  return unit;
}

// ── Per-instance state: the grid and its frame buffers ───────────────────────
const state = sketch.state( () => ( {
  gridKey: null,
  grid: null,
  offX: null,
  offZ: null,
  heights: null,
  field: null,
  links: null,
  bounds: null,
  cursorTarget: null,
  cursorLag: null,
  fallOrders: []
} ) );

function ensureGrid(
  field, aspect
) {
  const key = [
    field.density,
    field.layout,
    field.jitter,
    field.seed,
    aspect.toFixed( 4 )
  ].join( "|" );

  if ( state.gridKey === key ) {
    return state.grid;
  }

  const grid = buildGrid( {
    cols: field.density,
    aspect,
    jitter: field.jitter,
    seed: field.seed,
    layout: field.layout
  } );

  state.gridKey = key;
  state.grid = grid;
  state.offX = new Float32Array( grid.count );
  state.offZ = new Float32Array( grid.count );
  state.heights = new Float32Array( grid.count );
  state.field = new Uint8Array( grid.count * 4 );
  state.links = new Uint8Array( grid.count * 4 );
  state.bounds = new Uint8Array( grid.count * 4 );
  state.cursorTarget = new Float32Array( grid.count );
  state.cursorLag = new Float32Array( grid.count );

  return grid;
}

function easingFn( name ) {
  return typeof easing[ name ] === "function" ? easing[ name ] : ( x ) => x;
}

sketch.setup( async() => {
  state.gridKey = null;
  state.grid = null;

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const text = o.text ?? {};
  const field = o.field ?? {};
  const relief = o.relief ?? {};
  const rhythm = o.rhythm ?? {};
  const rise = o.rise ?? {};
  const fall = o.fall ?? {};
  const links = o.links ?? {};
  const material = o.material ?? {};
  const cursor = o.cursor ?? {};
  const interaction = o.interaction ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const rendering = o.rendering ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const aspect = p.width / p.height;
  const progression = animation.progression;
  const t = animation.angle;

  // ── The text, one mask per unit ──────────────────────────────────────────
  const units = textUnits(
    text.value ?? "SCULPT",
    text.group ?? "letter"
  );
  const masks = [];

  for ( const unit of units ) {
    const mask = getMask( {
      unit,
      fontName: text.font ?? "agiro",
      size: clamp(
        text.size ?? 0.78,
        0.05,
        1.5
      ),
      weight: text.weight ?? 0,
      offset: text.offset,
      aspect
    } );

    // Font still loading: background only until it resolves.
    if ( !mask ) {
      return;
    }

    masks.push( mask );
  }

  // ── The sheet ────────────────────────────────────────────────────────────
  const fieldCfg = {
    density: clamp(
      Math.round( field.density ?? 48 ),
      12,
      96
    ),
    layout: field.layout ?? "grid",
    jitter: field.jitter ?? 0.3,
    seed: Math.round( field.seed ?? 7 )
  };
  const grid = ensureGrid(
    fieldCfg,
    aspect
  );
  const reliefCfg = {
    mask: relief.mask ?? "fill",
    band: relief.band ?? 0.06,
    profile: relief.profile ?? "dome",
    domeRadius: relief.domeRadius ?? 0.05,
    feather: clamp(
      relief.feather ?? 0.2,
      0,
      1
    )
  };
  const riseCfg = {
    order: rise.order ?? "radial-out",
    angle: rise.angle ?? 0
  };
  const fallCfg = {
    order: fall.order ?? "mirror"
  };
  const prepared = masks.map( ( mask ) => getUnit( {
    mask,
    grid,
    gridKey: state.gridKey,
    relief: reliefCfg,
    rise: riseCfg,
    fall: fallCfg,
    aspect,
    seed: fieldCfg.seed
  } ) );

  // ── Heights: the beat, the handover, the envelope ────────────────────────
  const repeats = Math.max(
    1,
    Math.round( rhythm.repeats ?? 1 )
  );
  const tBeats = progression * units.length * repeats;

  state.fallOrders.length = 0;

  for ( const unit of prepared ) {
    state.fallOrders.push( unit.fallOrder );
  }

  const stage = computeHeights(
    prepared,
    tBeats,
    {
      hold: rhythm.hold ?? 0.4,
      transition: rhythm.transition ?? "morph",
      rise: {
        spread: rise.spread ?? 0.6,
        ease: easingFn( rise.easing ?? "easeOutBack" )
      },
      fall: {
        spread: fall.spread ?? rise.spread ?? 0.6,
        ease: easingFn( fall.easing ?? "easeInCubic" ),
        mirror: fallCfg.order === "mirror",
        order: fallCfg.order === "mirror" ? null : state.fallOrders
      }
    },
    state.heights
  );

  // ── Offsets: jitter plus the loop-clock drift ────────────────────────────
  driftOffsets(
    grid,
    {
      amount: field.drift ?? 0.08,
      scale: field.driftScale ?? 2,
      cycles: field.driftCycles ?? 1,
      seed: fieldCfg.seed,
      progression
    },
    state.offX,
    state.offZ
  );

  // ── Camera ───────────────────────────────────────────────────────────────
  const sheetRadius = Math.hypot(
    aspect,
    1
  );
  const basis = cameraBasis(
    camera,
    {
      radius: sheetRadius,
      aspect,
      progression
    }
  );

  // ── Cursor: a hand under (or on) the sheet ───────────────────────────────
  // Pointers are dropped onto the sheet's plane through the same camera the
  // shader traces, so a finger sits under the point it covers on screen. The
  // influence chases its target with an exponential lag; with no pointer it
  // decays to nothing, which is the capture case.
  const cursorMode = cursor.mode ?? "lift";
  const cursorOn = cursorMode !== "off" && interaction.enabled !== false;

  if ( cursorOn ) {
    const groups = getPointerGroups( interaction );
    const cursors = [];

    for ( const group of groups ) {
      for ( const point of group.points ) {
        const hit = hitPlaneY(
          basis,
          screenRay(
            basis,
            point.x,
            point.y,
            p.width,
            p.height
          ),
          0
        );

        if ( hit ) {
          cursors.push( {
            u: ( hit[ 0 ] + aspect ) / ( 2 * aspect ),
            v: ( 1 - hit[ 2 ] ) / 2
          } );
        }
      }
    }

    cursorField(
      grid,
      state.offX,
      state.offZ,
      cursors,
      cursor.radius ?? 0.22,
      easingFn( cursor.falloff ?? "easeOutQuad" ),
      aspect,
      state.cursorTarget
    );

    const follow = 1 - clamp(
      cursor.lag ?? 0.5,
      0,
      0.95
    );
    const strength = cursor.strength ?? 0.6;
    const lag = state.cursorLag;

    for ( let n = 0; n < grid.count; n++ ) {
      lag[ n ] += ( state.cursorTarget[ n ] - lag[ n ] ) * follow;

      if ( lag[ n ] < 1e-4 ) {
        lag[ n ] = 0;
        continue;
      }

      if ( cursorMode === "lift" ) {
        state.heights[ n ] = Math.min(
          HEIGHT_MAX,
          state.heights[ n ] + strength * lag[ n ]
        );
      } else if ( cursorMode === "press" ) {
        state.heights[ n ] = Math.max(
          HEIGHT_MIN,
          state.heights[ n ] - strength * lag[ n ]
        );
      } else if ( cursors.length ) {
        // Attract: slide toward the nearest cursor, in cell units.
        const i = n % grid.cols;
        const j = ( n - i ) / grid.cols;
        const u = ( i + 0.5 + state.offX[ n ] ) / grid.cols;
        const v = ( j + 0.5 + state.offZ[ n ] ) / grid.rows;
        let best = null;
        let bestDist = Infinity;

        for ( const c of cursors ) {
          const dist = Math.hypot(
            ( c.u - u ) * aspect,
            c.v - v
          );

          if ( dist < bestDist ) {
            bestDist = dist;
            best = c;
          }
        }

        const pull = strength * lag[ n ] * 0.5;

        state.offX[ n ] = clamp(
          state.offX[ n ] + ( best.u - u ) * grid.cols * pull,
          -MAX_OFFSET,
          MAX_OFFSET
        );
        state.offZ[ n ] = clamp(
          state.offZ[ n ] + ( best.v - v ) * grid.rows * pull,
          -MAX_OFFSET,
          MAX_OFFSET
        );
      }
    }
  } else if ( state.cursorLag ) {
    state.cursorLag.fill( 0 );
  }

  // ── Links, then the textures ─────────────────────────────────────────────
  const currentMask = masks[ stage.current ];
  const nextMask = masks[ stage.next ];
  const inTransition = stage.q > 0;

  linkWeights(
    grid,
    state.heights,
    state.offX,
    state.offZ,
    {
      reach: links.reach ?? "8",
      rule: links.rule ?? "ink",
      maxLength: links.maxLength ?? 1.8,
      inkAt: (
        u, v
      ) => inkAt(
        currentMask,
        u,
        v
      ) || ( inTransition && inkAt(
        nextMask,
        u,
        v
      ) )
    },
    state.links
  );
  packField(
    grid,
    state.offX,
    state.offZ,
    state.heights,
    state.field
  );

  // The air ceiling / floor per cell, and the sheet's real extremes for the
  // box — after the cursor has had its say on the heights.
  const extremes = packBounds(
    grid,
    state.heights,
    state.bounds
  );

  // ── Material, in world units derived from the cell ───────────────────────
  const cellX = ( 2 * aspect ) / grid.cols;
  const cellZ = 2 / grid.rows;
  const cellMin = Math.min(
    cellX,
    cellZ
  );
  const thickness = cellMin * ( material.thickness ?? 0.35 );
  const tubeRest = thickness * ( links.restWeight ?? 0.25 );
  const tubeGain = thickness * ( links.gain ?? 1 );
  const bead = cellMin * ( field.bead ?? 0.15 );
  const smoothK = Math.max(
    cellMin * ( material.fusion ?? 0.3 ),
    1e-4
  );
  // Clamped once, so the slab, the air planes and the decode agree on the sign.
  const height = Math.max(
    relief.height ?? 0.7,
    0
  );
  const maxRadius = Math.max(
    bead,
    tubeRest + tubeGain * WEIGHT_MAX
  );

  // ── Palette / lighting ───────────────────────────────────────────────────
  const timeScale = o.timeScale ?? 1;
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * timeScale * p.TAU * hueSpread );
  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.7
  );

  reliefRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    // One texel per cell, re-uploaded every frame: the offsets and the 16-bit
    // height in one, the four link weights the cell owns in the other.
    textures: {
      uField: {
        data: state.field,
        width: grid.cols,
        height: grid.rows
      },
      uLinks: {
        data: state.links,
        width: grid.cols,
        height: grid.rows
      },
      uBounds: {
        data: state.bounds,
        width: grid.cols,
        height: grid.rows
      }
    },
    uniforms: {
      uT: t,
      uGrid: [
        grid.cols,
        grid.rows
      ],
      uCell: [
        cellX,
        cellZ
      ],
      uHalf: [
        aspect,
        1
      ],
      uHeight: height,
      uBead: bead,
      uTubeRest: tubeRest,
      uTubeGain: tubeGain,
      uSmoothK: smoothK,
      uCellBound: cellMin,
      // The fillet can bulge a quarter of smoothK past the primitives; the
      // whole of it goes into every bound.
      uAirMargin: maxRadius + smoothK + 0.003,
      uSlabTop: extremes.max * height + maxRadius + smoothK,
      uSlabBottom: extremes.min * height - maxRadius - smoothK,
      ...cameraUniforms( basis ),
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.9,
      uPipeHueShift: colors.pipeHueShift ?? 0.6,
      uShimmer: colors.shimmer ?? 2.2,
      uSaturation: colors.saturation ?? 0.8,
      uBrightness: colors.brightness ?? 1.25,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.75,
      uSpecular: light.specular ?? 1.1,
      uSpecPower: light.specPower ?? 42,
      uFresnelPower: light.fresnelPower ?? 2.2,
      uRimStrength: light.rimStrength ?? 0.6,
      // The look: tube (the material above) or fringe (its rim term alone).
      uLook: {
        int: ( material.look ?? "tube" ) === "fringe" ? 1 : 0
      },
      uFringeWidth: Math.max(
        material.fringeWidth ?? 1,
        0.05
      ),
      uFringeGlow: material.fringeGlow ?? 3,
      uFringeBody: material.fringeBody ?? 0.1,
      // Cast shadows stay off: a shadow ray meets a cell wall at every step
      // and reads it as an occluder (the flip-v3 finding).
      uShadowSoft: 0,
      uFogDensity: camera.fogDensity ?? 0.05,
      uFogStart: basis.distance,
      uMaxDist: basis.distance + 2 * sheetRadius + 2 * height + 2,
      uAberration: 0,
      uAberrationMode: {
        int: 0
      }
    }
  } );

  if ( cursorOn ) {
    drawInteractionCameraPreview( interaction );
  }
} );
