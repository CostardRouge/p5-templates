import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import graphics from "@/p5/utils/graphics.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  splitContours,
  resampleContour
} from "@/p5/utils/letterPaths.js";
import {
  LETTERS,
  clamp,
  cellChar,
  lerpColor,
  ensurePath,
  resolveReadingPosition
} from "../_grid.js";

// ─────────────────────────────────────────────────────────────────────────────
// letter-grid v2 — "extrude"
//
// Same infinite virtual grid + word-path + reading-head camera as v1 (shared via
// ../_grid.js), but rendered as a 3D scene. The whole sea of letters lies flat on
// the ground, and the letter(s) under the reading head RISE out of it — a true
// extrusion of the glyph outline (cap + walls), lit by a movable light and casting
// a LETTER-SHAPED shadow back onto the terrain.
//
// Flat and raised letters share ONE glyph-geometry path (the flat ones are just a
// cap on the ground), so they always agree in orientation and position. How many
// cells rise is a continuous ELEVATION field — a multiplier + a spread: spread→0
// raises only the centred letter, larger spreads reach its neighbours then cells
// further out, shaped by a falloff easing.
//
// Everything is a pure function of animation.progression → seamless loop, and the
// camera/light never use orbitControl or per-frame randomness → recording-safe.
// ─────────────────────────────────────────────────────────────────────────────

// World units per grid cell — the on-screen size is governed by the camera; this
// just keeps the glyph/shadow maths in comfortable numbers.
const CELL = 100;
// Reference size the glyph outline is sampled at; draw-time scale = letterScale.
const REF = 100;
// Tiny lifts above the ground to keep coplanar layers from z-fighting.
const FLAT_Y = -0.4;
const SHADOW_Y = -0.8;

const state = {
  scene: null,
  glyphs: new Map(),
  caps: new Map(),
  store: {
    key: "",
    path: [],
    alphabet: LETTERS,
    seed: 1
  }
};

// Even-odd point-in-polygon across ALL contours of a glyph (outer + holes), used
// to orient each wall's normal so it faces OUT of the solid.
function pointInContours(
  x, y, contours
) {
  let inside = false;

  for ( const cont of contours ) {
    for ( let i = 0, j = cont.length - 1; i < cont.length; j = i++ ) {
      const xi = cont[ i ].x;
      const yi = cont[ i ].y;
      const xj = cont[ j ].x;
      const yj = cont[ j ].y;
      const intersect = ( yi > y ) !== ( yj > y )
        && x < ( ( xj - xi ) * ( y - yi ) ) / ( yj - yi || 1e-6 ) + xi;

      if ( intersect ) {
        inside = !inside;
      }
    }
  }

  return inside;
}

// Outward horizontal normal per edge of a contour (glyph y maps to world z).
function outwardNormals(
  contour, allContours
) {
  const out = [];
  const step = REF * 0.04;

  for ( let i = 0; i < contour.length; i++ ) {
    const a = contour[ i ];
    const b = contour[ ( i + 1 ) % contour.length ];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(
      ex,
      ey
    ) || 1;
    let nx = ey / len;
    let ny = -ex / len;
    const mx = ( a.x + b.x ) / 2;
    const my = ( a.y + b.y ) / 2;

    if ( pointInContours(
      mx + nx * step,
      my + ny * step,
      allContours
    ) ) {
      nx = -nx;
      ny = -ny;
    }

    out.push( {
      x: nx,
      z: ny
    } );
  }

  return out;
}

function bboxArea( contour ) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

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

  return ( maxX - minX ) * ( maxY - minY );
}

// Cached glyph outline: contours (outer first, then holes) + per-edge outward
// normals, sampled once at REF and scaled at draw time.
function getGlyphGeometry(
  char, font, sampleFactor
) {
  const key = `${ char }|${ sampleFactor }`;
  const cached = state.glyphs.get( key );

  if ( cached ) {
    return cached;
  }

  const raw = string.getTextPoints( {
    text: char,
    size: REF,
    font,
    sampleFactor,
    simplifyThreshold: 0
  } );

  let contours = splitContours(
    raw,
    REF * 0.34
  )
    .map( ( c ) => resampleContour(
      c,
      REF * 0.06,
      true
    ) )
    .filter( ( c ) => c.length >= 3 )
    // Flip the glyph's Y (which maps to world Z): the floor camera + the scene's
    // scale(-1,…) (see draw) leave the glyph readable in X but upside-down along
    // the depth axis, so pre-flip it here. Done before normals so they stay outward.
    .map( ( c ) => c.map( ( pt ) => ( {
      x: pt.x,
      y: -pt.y
    } ) ) );

  if ( contours.length > 1 ) {
    // Outer outline (largest bbox) first; the rest are holes / counters.
    contours = contours
      .map( ( c ) => ( {
        c,
        area: bboxArea( c )
      } ) )
      .sort( (
        a, b
      ) => b.area - a.area )
      .map( ( entry ) => entry.c );
  }

  const geometry = {
    contours,
    normals: contours.map( ( c ) => outwardNormals(
      c,
      contours
    ) )
  };

  state.glyphs.set(
    key,
    geometry
  );

  return geometry;
}

// The cells that rise this frame: elevation = height × multiplier × falloff of the
// distance from the reading head, scaled by `spread`. spread→0 lifts only the
// centred cell; larger spreads reach neighbours then further out. Capped for perf.
function liftedCells( {
  camCol,
  camRow,
  radius,
  baseHeight,
  multiplier,
  spread,
  falloffEase,
  maxCells
} ) {
  const cells = [];
  const colC = Math.round( camCol );
  const rowC = Math.round( camRow );
  const safeSpread = Math.max(
    1e-3,
    spread
  );

  for ( let col = colC - radius; col <= colC + radius; col++ ) {
    for ( let row = rowC - radius; row <= rowC + radius; row++ ) {
      const dx = col - camCol;
      const dy = row - camRow;
      const dist = Math.sqrt( dx * dx + dy * dy );
      const u = dist / safeSpread;

      if ( u >= 1 ) {
        continue;
      }

      const height = baseHeight * multiplier * falloffEase( 1 - u );

      if ( height > 0.5 ) {
        cells.push( {
          col,
          row,
          height,
          dist
        } );
      }
    }
  }

  cells.sort( (
    a, b
  ) => b.height - a.height );

  return cells.slice(
    0,
    maxCells
  );
}

// Terrain colour for one cell: dim base, brightening toward the centre, with the
// spelled word's cells glowing in the accent colour.
function cellColor( {
  col,
  row,
  camCol,
  camRow,
  from,
  to,
  fromLit,
  toLit,
  colors,
  focusEase
} ) {
  const dx = col - camCol;
  const dy = row - camRow;
  const dist = Math.sqrt( dx * dx + dy * dy );
  const focus = focusEase( clamp(
    1 - dist / Math.max(
      0.3,
      colors.focusRadius
    ),
    0,
    1
  ) );

  let color = lerpColor(
    colors.grid,
    colors.focus,
    focus
  );

  let accentWeight = 0;

  if ( from && col === from.col && row === from.row ) {
    accentWeight = fromLit;
  } else if ( to && col === to.col && row === to.row ) {
    accentWeight = toLit;
  }

  if ( accentWeight > 0 ) {
    color = lerpColor(
      color,
      colors.accent,
      accentWeight * ( 0.35 + 0.65 * focus )
    );
  }

  return color;
}

// The flat glyph cap, tessellated ONCE per character into a retained geometry
// (in glyph units, at y = 0) and cached. The terrain draws ~hundreds of these a
// frame, so re-tessellating each one every frame is the cost that matters; with a
// cached mesh the per-frame work is just a model() draw. Built outside the scene's
// shape stream (buildGeometry opens its own), so the caller pre-warms the cache.
function getCapMesh(
  g, p, char, font, sampleFactor
) {
  const key = `${ char }|${ sampleFactor }`;

  if ( state.caps.has( key ) ) {
    return state.caps.get( key );
  }

  const geometry = getGlyphGeometry(
    char,
    font,
    sampleFactor
  );

  if ( !geometry.contours.length ) {
    state.caps.set(
      key,
      null
    );

    return null;
  }

  const mesh = g.buildGeometry( () => {
    g.beginShape( p.TESS );

    const outer = geometry.contours[ 0 ];

    for ( const pt of outer ) {
      g.vertex(
        pt.x,
        0,
        pt.y
      );
    }

    for ( let c = 1; c < geometry.contours.length; c++ ) {
      g.beginContour();

      for ( const pt of geometry.contours[ c ] ) {
        g.vertex(
          pt.x,
          0,
          pt.y
        );
      }

      g.endContour();
    }

    g.endShape( p.CLOSE );
  } );

  state.caps.set(
    key,
    mesh
  );

  return mesh;
}

// One letter-shaped shadow: the glyph outline projected from its top rim onto the
// ground along the light direction, filled dark (a soft second pass widens it).
function drawShadow(
  g, p, geometry, k, height, light, color, opacity, softness
) {
  if ( !geometry.contours.length || opacity <= 0 ) {
    return;
  }

  const t = height / Math.max(
    0.06,
    light.y
  );

  const emit = (
    scale, alpha
  ) => {
    g.fill(
      color[ 0 ],
      color[ 1 ],
      color[ 2 ],
      alpha
    );
    g.beginShape( p.TESS );

    const outer = geometry.contours[ 0 ];

    for ( const pt of outer ) {
      g.vertex(
        pt.x * k * scale + light.x * t,
        SHADOW_Y,
        pt.y * k * scale + light.z * t
      );
    }

    for ( let c = 1; c < geometry.contours.length; c++ ) {
      g.beginContour();

      for ( const pt of geometry.contours[ c ] ) {
        g.vertex(
          pt.x * k * scale + light.x * t,
          SHADOW_Y,
          pt.y * k * scale + light.z * t
        );
      }

      g.endContour();
    }

    g.endShape( p.CLOSE );
  };

  emit(
    1,
    opacity * 255
  );

  if ( softness > 0 ) {
    emit(
      1 + 0.18 * softness,
      opacity * 0.5 * 255
    );
  }
}

// The extruded glyph: a tessellated top cap at -height plus quad side walls down to
// the ground, each wall carrying its outward normal so the light shades it.
function drawExtrudedGlyph(
  g, p, geometry, k, height, color
) {
  if ( !geometry.contours.length ) {
    return;
  }

  g.ambientMaterial(
    color[ 0 ],
    color[ 1 ],
    color[ 2 ]
  );
  g.fill(
    color[ 0 ],
    color[ 1 ],
    color[ 2 ]
  );

  // Top cap (with holes).
  g.beginShape( p.TESS );

  const outer = geometry.contours[ 0 ];

  for ( const pt of outer ) {
    g.vertex(
      pt.x * k,
      -height,
      pt.y * k
    );
  }

  for ( let c = 1; c < geometry.contours.length; c++ ) {
    g.beginContour();

    for ( const pt of geometry.contours[ c ] ) {
      g.vertex(
        pt.x * k,
        -height,
        pt.y * k
      );
    }

    g.endContour();
  }

  g.endShape( p.CLOSE );

  // Side walls.
  g.beginShape( p.TRIANGLES );

  for ( let c = 0; c < geometry.contours.length; c++ ) {
    const contour = geometry.contours[ c ];
    const normals = geometry.normals[ c ];
    const n = contour.length;

    for ( let i = 0; i < n; i++ ) {
      const a = contour[ i ];
      const b = contour[ ( i + 1 ) % n ];
      const nm = normals[ i ];
      const ax = a.x * k;
      const az = a.y * k;
      const bx = b.x * k;
      const bz = b.y * k;

      g.normal(
        nm.x,
        0,
        nm.z
      );
      g.vertex(
        ax,
        -height,
        az
      );
      g.vertex(
        bx,
        -height,
        bz
      );
      g.vertex(
        bx,
        0,
        bz
      );
      g.vertex(
        ax,
        -height,
        az
      );
      g.vertex(
        bx,
        0,
        bz
      );
      g.vertex(
        ax,
        0,
        az
      );
    }
  }

  g.endShape();
}

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
    `rgba(${ color[ 0 ] }, ${ color[ 1 ] }, ${ color[ 2 ] }, 0)`
  );
  gradient.addColorStop(
    1,
    `rgba(${ color[ 0 ] }, ${ color[ 1 ] }, ${ color[ 2 ] }, ${ clamp(
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

sketch.setup( ( {
  canvas
} ) => {
  state.scene = graphics.createAutoResizableGraphics(
    canvas.width,
    canvas.height,
    "webgl"
  );
  state.scene.pixelDensity( 1 );
  // Cap meshes are retained geometries bound to this graphics; drop any built for
  // a previous instance so they are rebuilt against the fresh renderer.
  state.caps.clear();
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  const wordCfg = o.word ?? {};
  const gridCfg = o.grid ?? {};
  const motionCfg = o.motion ?? {};
  const extrudeCfg = o.extrude ?? {};
  const elevationCfg = o.elevation ?? {};
  const lightCfg = o.light ?? {};
  const shadowCfg = o.shadow ?? {};
  const cameraCfg = o.camera ?? {};
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

  const g = state.scene;

  if ( !g ) {
    return;
  }

  const font = string.fonts[ gridCfg.font ] ?? string.fonts.spaceMonoRegular;

  if ( !font?.font ) {
    return;
  }

  // ── Reading head (shared engine) ──────────────────────────────────────────
  const radius = Math.max(
    2,
    Math.round( gridCfg.gridRadius ?? 6 )
  );
  const viewRadius = Math.max(
    2,
    gridCfg.searchViewRadius ?? 5
  );
  const spread = clamp(
    motionCfg.searchSpread ?? 0.6,
    0,
    1
  );

  ensurePath(
    state.store,
    {
      wordCfg,
      spread,
      viewRadius
    }
  );

  const {
    path,
    alphabet,
    seed
  } = state.store;

  const {
    camCol,
    camRow,
    from,
    to,
    fromLit,
    toLit
  } = resolveReadingPosition( {
    path,
    progression: animation.progression,
    dwell: motionCfg.dwell ?? 0.45,
    easeFn: easing[ motionCfg.easing ] ?? easing.easeInOutCubic
  } );

  const letterScale = clamp(
    gridCfg.letterScale ?? 0.7,
    0.1,
    1.4
  );
  const sampleFactor = gridCfg.sampleFactor ?? 0.18;
  const k = letterScale;

  // ── Which cells rise this frame ───────────────────────────────────────────
  const baseHeight = CELL * Math.max(
    0,
    extrudeCfg.height ?? 1.1
  );
  const lifted = liftedCells( {
    camCol,
    camRow,
    radius,
    baseHeight,
    multiplier: Math.max(
      0,
      elevationCfg.multiplier ?? 1
    ),
    spread: Math.max(
      0,
      elevationCfg.spread ?? 0.6
    ),
    falloffEase: easing[ elevationCfg.falloff ] ?? easing.easeInOutSine,
    maxCells: Math.round( elevationCfg.maxCells ?? 36 )
  } );
  const liftedKeys = new Set( lifted.map( ( c ) => `${ c.col },${ c.row }` ) );

  // ── Colours / light ───────────────────────────────────────────────────────
  const colors = {
    grid: colorsCfg.grid ?? [
      135,
      135,
      155,
      255
    ],
    focus: colorsCfg.focus ?? [
      235,
      235,
      245,
      255
    ],
    accent: colorsCfg.accent ?? [
      120,
      200,
      255,
      255
    ],
    focusRadius: colorsCfg.focusRadius ?? 1.3
  };
  const focusEase = easing[ colorsCfg.focusEasing ] ?? easing.easeOutQuad;
  const letterColor = colorsCfg.letter ?? [
    225,
    225,
    235,
    255
  ];
  const groundColor = colorsCfg.ground ?? [
    20,
    20,
    28,
    255
  ];

  const el = p.radians( clamp(
    lightCfg.elevation ?? 42,
    5,
    89
  ) );
  const az = p.radians( lightCfg.azimuth ?? 235 );
  const cosEl = Math.cos( el );
  const light = {
    x: cosEl * Math.cos( az ),
    y: Math.max(
      0.06,
      Math.sin( el )
    ),
    z: cosEl * Math.sin( az )
  };
  const lightIntensity = clamp(
    lightCfg.intensity ?? 0.85,
    0,
    1
  );
  const lightColor = lightCfg.color ?? [
    255,
    250,
    240
  ];
  const ambient = clamp(
    lightCfg.ambient ?? 0.35,
    0,
    1
  );

  // ── Camera ────────────────────────────────────────────────────────────────
  // Explicit camera — a Graphics has its own default eye ~1.2k units back, so a
  // plain translate would stack on it. `tilt` is the pitch below the horizon
  // (89° ≈ straight down).
  const pitch = p.radians( clamp(
    cameraCfg.tilt ?? 52,
    5,
    89
  ) );
  const distance = cameraCfg.distance ?? 1300;
  const sinPitch = Math.sin( pitch );
  const cosPitch = Math.cos( pitch );

  const colC = Math.round( camCol );
  const rowC = Math.round( camRow );

  // Pre-warm the glyph-cap cache OUTSIDE the scene's transform/shape stream:
  // buildGeometry opens its own collection, so it must not run mid-scene (it would
  // otherwise bake the camera transform into the cached mesh). After a few frames
  // every visible character is cached and this loop only does map lookups.
  for ( let col = colC - radius; col <= colC + radius; col++ ) {
    for ( let row = rowC - radius; row <= rowC + radius; row++ ) {
      getCapMesh(
        g,
        p,
        cellChar(
          col,
          row,
          seed,
          alphabet
        ),
        font,
        sampleFactor
      );
    }
  }

  g.clear();
  g.push();
  g.noStroke();
  g.perspective(
    p.radians( clamp(
      cameraCfg.fov ?? 36,
      10,
      90
    ) ),
    g.width / g.height,
    1,
    200000
  );
  g.camera(
    0,
    -distance * sinPitch,
    distance * cosPitch,
    0,
    cameraCfg.lift ?? 0,
    0,
    0,
    -cosPitch,
    -sinPitch
  );
  // Un-mirror screen-X (this camera basis flips it); the glyph's depth is
  // pre-flipped in getGlyphGeometry so letters read upright on the ground.
  g.scale(
    -1,
    1,
    1
  );

  // ── Ground plane (unlit, so the printed letters read flatly) ──────────────
  const half = ( radius + 1 ) * CELL;

  g.fill( ...groundColor );
  g.beginShape();
  g.vertex(
    -half,
    0,
    -half
  );
  g.vertex(
    half,
    0,
    -half
  );
  g.vertex(
    half,
    0,
    half
  );
  g.vertex(
    -half,
    0,
    half
  );
  g.endShape( p.CLOSE );

  // ── Flat terrain letters (unlit, cached caps drawn via model()) ───────────
  for ( let col = colC - radius; col <= colC + radius; col++ ) {
    for ( let row = rowC - radius; row <= rowC + radius; row++ ) {
      if ( liftedKeys.has( `${ col },${ row }` ) ) {
        continue;
      }

      const mesh = getCapMesh(
        g,
        p,
        cellChar(
          col,
          row,
          seed,
          alphabet
        ),
        font,
        sampleFactor
      );

      if ( !mesh ) {
        continue;
      }

      const color = cellColor( {
        col,
        row,
        camCol,
        camRow,
        from,
        to,
        fromLit,
        toLit,
        colors,
        focusEase
      } );

      g.push();
      g.translate(
        ( col - camCol ) * CELL,
        FLAT_Y,
        ( row - camRow ) * CELL
      );
      g.scale(
        k,
        1,
        k
      );
      g.fill( ...color );
      g.model( mesh );
      g.pop();
    }
  }

  // ── Shadows (still unlit → literal dark, alpha-blended onto the terrain) ───
  const shadowColor = shadowCfg.color ?? [
    0,
    0,
    0
  ];
  const shadowOpacity = clamp(
    shadowCfg.opacity ?? 0.6,
    0,
    1
  );
  const shadowSoftness = Math.max(
    0,
    shadowCfg.softness ?? 0.5
  );

  for ( const cell of lifted ) {
    g.push();
    g.translate(
      ( cell.col - camCol ) * CELL,
      0,
      ( cell.row - camRow ) * CELL
    );
    drawShadow(
      g,
      p,
      getGlyphGeometry(
        cellChar(
          cell.col,
          cell.row,
          seed,
          alphabet
        ),
        font,
        sampleFactor
      ),
      k,
      cell.height,
      light,
      shadowColor,
      shadowOpacity,
      shadowSoftness
    );
    g.pop();
  }

  // ── Lights on for the raised letters ──────────────────────────────────────
  g.ambientLight( ambient * 255 );
  g.directionalLight(
    lightColor[ 0 ] * lightIntensity,
    lightColor[ 1 ] * lightIntensity,
    lightColor[ 2 ] * lightIntensity,
    light.x,
    light.y,
    light.z
  );

  for ( const cell of lifted ) {
    let color = letterColor;
    let accentWeight = 0;

    if ( from && cell.col === from.col && cell.row === from.row ) {
      accentWeight = fromLit;
    } else if ( to && cell.col === to.col && cell.row === to.row ) {
      accentWeight = toLit;
    }

    if ( accentWeight > 0 ) {
      color = lerpColor(
        letterColor,
        colors.accent,
        accentWeight
      );
    }

    g.push();
    g.translate(
      ( cell.col - camCol ) * CELL,
      0,
      ( cell.row - camRow ) * CELL
    );
    drawExtrudedGlyph(
      g,
      p,
      getGlyphGeometry(
        cellChar(
          cell.col,
          cell.row,
          seed,
          alphabet
        ),
        font,
        sampleFactor
      ),
      k,
      cell.height,
      color
    );
    g.pop();
  }

  g.pop();

  p.image(
    g,
    0,
    0
  );
  g.reset();

  drawVignette( {
    amount: vignetteCfg.amount ?? 0.6,
    radius: vignetteCfg.radius ?? 0.5,
    softness: vignetteCfg.softness ?? 0.6,
    color: vignetteCfg.color ?? background
  } );

  renderTitle();
} );
