import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl
} from "@/p5/utils/braidShader.js";
import {
  CAMERA_RIG_UNIFORMS_GLSL,
  CAMERA_RIG_MAIN_GLSL
} from "@/p5/utils/cameraRig.js";
import {
  HEIGHT_MIN,
  HEIGHT_MAX,
  WEIGHT_MAX,
  MAX_OFFSET
} from "./_mesh.js";

// ─────────────────────────────────────────────────────────────────────────────
// The TRACE: the GLSL that raymarches a grid sculpt, shared by the sketches
// that draw a `_mesh.js` field — one texel per cell, a `floor` to find the
// cell under a sample, a 5 × 5 scan around it, a step bounded by the cell
// walls and by a per-cell air ceiling. `sculpt-v2-letter-relief` carries all
// of this inline and stays untouched (a published sketch is edited only for
// fixes); this module is the same trace factored for the sketches after it,
// so a new grid sculpt writes ONLY what it puts in a cell:
//
//   • LINKS_CELL_GLSL — v2's cell: a junction bead plus the four links the cell
//     owns (E, S, SE, SW), read from `uLinks` (v5, v7, v9);
//   • ORIENTED_CELL_GLSL — one oriented primitive per cell: a capsule of a
//     given half-length and angle (a dot at length 0, a dash otherwise) or a
//     rounded box, read from `uProp` (v6, v8).
//
// Both are `float cellDist( p, ij, di, dj, d )`: the union of what cell K =
// sample cell + ( di, dj ) contributes, folded into `d` with `smin`. The
// framework around them (`gridFragment`) is v2's, with its two bound rules:
//
//   • the step never exceeds the distance to the cell's walls plus
//     `uCellBound`, so a ray never skips into geometry the scan has not
//     seen. v2 sets that to one cell; `cellBoundFor` derives it from the
//     widest thing a cell can hold instead, so a fat tube or a long dash
//     owned by a cell three away is provably beyond it (see the function);
//   • above the highest point within two cells plus `uAirMargin` (and below
//     the lowest) the vertical gap is a distance to everything the scan could
//     find, and the scan is skipped for one texel (`uBounds`, packBounds).
//
// A bound is a promise about where geometry is NOT: it is combined with plain
// `min`, never `smin`, and never returned below AIR_SLACK (the flip-v3 trap,
// docs/memory/sketches.md).
// ─────────────────────────────────────────────────────────────────────────────

// Thinner than this is not drawn: anything within the hit threshold of a
// zero-radius axis would render as a hairline, and a height of 0 decodes from
// 16 bits to a few 1e-6, not to 0.
export const MIN_RADIUS = 0.002;

// An air bound must never read as a surface either: kept above SURF_EPS and
// folded into uAirMargin on the CPU so the ceiling stays rigorous.
export const AIR_SLACK = 0.003;

// The trace's own uniforms; the cell chunks declare theirs.
export const GRID_TRACE_UNIFORMS_GLSL = `
  uniform sampler2D uField;      // offset x, offset z (cell units, -1..1), height hi, lo
  uniform vec2  uGrid;           // cols, rows
  uniform vec2  uCell;           // cell size, world (x, z)
  uniform vec2  uHalf;           // sheet half extents, world (x, z)
  uniform float uHeight;         // world units per unit of normalised height
  uniform float uSmoothK;        // smooth-union fillet, world
  uniform float uCellBound;      // how far past its walls a step may go, world
  uniform float uSlabTop;        // y above which nothing exists
  uniform float uSlabBottom;     // y below which nothing exists
  uniform sampler2D uBounds;     // per cell: R = highest, G = lowest height within two cells
  uniform float uAirMargin;      // widest radius + fillet + slack, world
`;

const GRID_TRACE_LIB_GLSL = `
  const float HEIGHT_MIN = ${ HEIGHT_MIN.toFixed( 4 ) };
  const float HEIGHT_RANGE = ${ ( HEIGHT_MAX - HEIGHT_MIN ).toFixed( 4 ) };
  const float WEIGHT_MAX = ${ WEIGHT_MAX.toFixed( 4 ) };
  const float MIN_RADIUS = ${ MIN_RADIUS.toFixed( 4 ) };
  const float AIR_SLACK = ${ AIR_SLACK.toFixed( 4 ) };

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

  // The fractional cell coordinates under a world point (u right, v down).
  vec2 sheetCell(vec3 p) {
    return vec2((p.x + uHalf.x) / uCell.x, (uHalf.y - p.z) / uCell.y);
  }
`;

// v2's cell: a junction bead, then the four links the cell owns. Cell K = the
// sample cell + (di, dj) contributes its bead when K is in the inner 3×3, and
// each owned link when K or the link's far end is in it — visited over the
// whole 5×5, that traces every capsule touching the block exactly once.
export const LINKS_CELL_GLSL = `
  uniform sampler2D uLinks;      // E, S, SE, SW link weights (0 = no link)
  uniform float uBead;           // junction sphere floor radius, world
  uniform float uTubeRest;       // link radius at rest, world
  uniform float uTubeGain;       // link radius per unit of weight, world
  uniform float uSqueeze;        // radius multiplier on everything (1 = as is)

  float linkRadius(float w) {
    return (uTubeRest + uTubeGain * w) * uSqueeze;
  }

  // Byte → weight; a zero byte means no link at all.
  float linkWeight(float byte) {
    return (byte * 255.0 - 1.0) / 254.0 * WEIGHT_MAX;
  }

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
      float rJ = max(uBead * uSqueeze, linkRadius(max(c.w, 0.0)));

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
`;

// One oriented primitive per cell, read from `uProp`: radius, angle and
// half-length as bytes (see packProps). A capsule with a half-length of 0 is
// a sphere (a halftone dot), with a half-length it is a dash; `uShape` 1
// makes the same thing a rounded box (a pixel, a bar). Every cell of the 5×5
// is traced: a primitive up to a cell long, offset by up to MAX_OFFSET, can
// reach the inner block from the ring.
export const ORIENTED_CELL_GLSL = `
  uniform sampler2D uProp;       // radius 0..1, angle 0..1 (× π), half-length 0..1 (× uLenMax)
  uniform float uRadRest;        // world radius at 0
  uniform float uRadGain;        // world radius per unit
  uniform float uLenMax;         // world half-length at 1
  uniform int   uShape;          // 0 = capsule (a sphere at length 0), 1 = rounded box
  uniform float uRounding;       // box corner rounding, fraction of the radius

  float cellDist(vec3 p, vec2 ij, float di, float dj, float d) {
    vec4 pr = texture2D(uProp, (ij + 0.5) / uGrid);
    float r = uRadRest + uRadGain * pr.x;

    if (r <= MIN_RADIUS) { return d; }

    vec4 c = cellData(ij);
    float ang = pr.y * PI;
    float hl = pr.z * uLenMax;
    vec3 q = p - c.xyz;
    // The primitive's axis on the sheet: angle 0 along +x (u), π / 2 along -z (v down).
    vec2 axis = vec2(cos(ang), -sin(ang));
    float along = dot(q.xz, axis);
    float across = dot(q.xz, vec2(-axis.y, axis.x));
    float e;

    if (uShape == 1) {
      float rounding = r * uRounding;
      vec3 b = vec3(hl + r, r, r) - rounding;
      vec3 a = abs(vec3(along, q.y, across)) - b;

      e = length(max(a, 0.0)) + min(max(a.x, max(a.y, a.z)), 0.0) - rounding;
    } else {
      float h = clamp(along, -hl, hl);

      e = length(vec3(along - h, q.y, across)) - r;
    }

    return smin(d, e, uSmoothK);
  }
`;

// The scene: the box around the whole sheet, the cell under the sample and
// its wall bound, the air skip, then the 5×5 scan.
const GRID_MAP_SCENE_GLSL = `
  float mapScene(vec3 p) {
    // The box holding the whole sheet at every height, one cell of margin.
    vec3 boxHalf = vec3(uHalf.x + uCell.x, (uSlabTop - uSlabBottom) * 0.5, uHalf.y + uCell.y);
    vec3 boxCtr = vec3(0.0, (uSlabTop + uSlabBottom) * 0.5, 0.0);
    vec3 q = abs(p - boxCtr) - boxHalf;
    float boxDist = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

    if (boxDist > uCellBound) { return boxDist; }

    // The cell under p, and the distance to its walls: nothing the scan
    // misses is closer than uCellBound past them.
    vec2 cellF = sheetCell(p);
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
`;

// Hue identity: a gradient across the sheet, by cell.
export const SHEET_HUE_GLSL = `
  float nearestPipe(vec3 p) {
    vec2 cellI = clamp(floor(sheetCell(p)), vec2(0.0), uGrid - 1.0);

    return 0.5 * (cellI.x / uGrid.x + cellI.y / uGrid.y);
  }
`;

/**
 * A complete fragment for a grid sculpt: the braid material, the camera rig,
 * the trace above, and the cell chunk the sketch chose.
 *
 * @param {object} cfg
 * @param {string} cfg.cell           LINKS_CELL_GLSL or ORIENTED_CELL_GLSL
 * @param {number} [cfg.maxSteps=112] sphere-trace iterations (the cell bound
 *   shortens steps near the sheet, so more than a free-space tracer)
 * @param {string} [cfg.extra=""]     more GLSL before the shading chunk
 * @returns {string}
 */
export function gridFragment( {
  cell,
  maxSteps = 112,
  extra = ""
} ) {
  return `
    ${ BRAID_UNIFORMS_GLSL }
    ${ CAMERA_RIG_UNIFORMS_GLSL }
    ${ GRID_TRACE_UNIFORMS_GLSL }
    ${ IRIDESCENT_GLSL }
    ${ GRID_TRACE_LIB_GLSL }
    ${ cell }
    ${ GRID_MAP_SCENE_GLSL }
    ${ SHEET_HUE_GLSL }
    ${ extra }
    ${ braidShadingGlsl( {
      maxSteps,
      look: true
    } ) }
    ${ CAMERA_RIG_MAIN_GLSL }
  `;
}

/**
 * How far past its cell's walls a step may go, in cells, for the widest
 * thing a cell can hold. A cell the scan never visits has its centre three
 * cells away on some axis; its point is within MAX_OFFSET of that centre and
 * its primitive reaches `reach` cells from the point (radius, half-length,
 * plus the fillet's k / 4 bulge), so its geometry is at least
 * 3 − MAX_OFFSET − reach from the sample's cell centre on that axis, and the
 * sample is at most half a cell from its centre: the step may go
 * 3 − MAX_OFFSET − 0.5 − reach past the wall. For the links scene the
 * nearest untraced geometry is a link owned by a cell in the scan's outer
 * ring (two away) whose far end is not in the inner block, hence 2 in place
 * of 3. Clamped so a very fat setting crawls rather than stalls: the bound
 * only shortens steps inside the slab, which the air ceiling keeps thin.
 *
 * @param {number} reachCells radius + half-length + fillet / 4, in cells
 * @param {"links"|"oriented"} scene
 */
export function cellBoundFor(
  reachCells, scene = "links"
) {
  const room = ( scene === "links" ? 2 : 3 ) - MAX_OFFSET - 0.5 - reachCells;

  return Math.min(
    1,
    Math.max(
      0.35,
      room
    )
  );
}

/**
 * Pack the oriented primitives into `uProp`'s RGBA8 texel per cell.
 *
 * @param {object} grid
 * @param {Float32Array} radius   0..1 per cell (× uRadGain, + uRadRest)
 * @param {Float32Array} angle    radians on the sheet, any value (kept mod π)
 * @param {Float32Array} length   0..1 per cell (× uLenMax)
 * @param {Uint8Array} out        count * 4 bytes
 */
export function packProps(
  grid, radius, angle, length, out
) {
  for ( let n = 0; n < grid.count; n++ ) {
    const a = ( ( angle[ n ] % Math.PI ) + Math.PI ) % Math.PI;

    out[ n * 4 ] = Math.round( Math.min(
      1,
      Math.max(
        0,
        radius[ n ]
      )
    ) * 255 );
    out[ n * 4 + 1 ] = Math.round( ( a / Math.PI ) * 255 ) % 256;
    out[ n * 4 + 2 ] = Math.round( Math.min(
      1,
      Math.max(
        0,
        length[ n ]
      )
    ) * 255 );
    out[ n * 4 + 3 ] = 255;
  }
}

/** The angle a packed byte decodes to (the shader's arithmetic), for tests. */
export function unpackAngle( byte ) {
  return ( byte / 255 ) * Math.PI;
}

/**
 * The uniforms every grid trace reads, from the grid and the material, in
 * world units derived from the cell (the sheet is 2 × aspect by 2 units).
 *
 * @param {object} cfg
 * @param {object} cfg.grid
 * @param {number} cfg.aspect
 * @param {number} cfg.height      world units per unit of normalised height
 * @param {number} cfg.smoothK     fillet, world
 * @param {number} cfg.reachCells  the widest primitive, cells (cellBoundFor)
 * @param {number} cfg.maxRadius   world, for the air margin and the slab
 * @param {{ min: number, max: number }} cfg.extremes packBounds' return
 * @param {"links"|"oriented"} [cfg.scene="links"]
 */
export function gridUniforms( {
  grid,
  aspect,
  height,
  smoothK,
  reachCells,
  maxRadius,
  extremes,
  scene = "links"
} ) {
  const cellX = ( 2 * aspect ) / grid.cols;
  const cellZ = 2 / grid.rows;
  const cellMin = Math.min(
    cellX,
    cellZ
  );

  return {
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
    uSmoothK: smoothK,
    uCellBound: cellMin * cellBoundFor(
      reachCells,
      scene
    ),
    // The fillet can bulge a quarter of smoothK past the primitives; the
    // whole of it goes into every bound.
    uAirMargin: maxRadius + smoothK + AIR_SLACK,
    uSlabTop: extremes.max * height + maxRadius + smoothK,
    uSlabBottom: extremes.min * height - maxRadius - smoothK
  };
}

/** The cell's short side in world units — the unit every material size is a fraction of. */
export function cellSize(
  grid, aspect
) {
  return Math.min(
    ( 2 * aspect ) / grid.cols,
    2 / grid.rows
  );
}
