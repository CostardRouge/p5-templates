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
  LETTERS,
  clamp,
  cellChar,
  lerpColor,
  ensurePath,
  resolveReadingPosition
} from "../_grid.js";
import {
  getGlyphGeometry,
  getCapMesh,
  clearCapCache,
  drawExtrudedGlyph
} from "../_extrude3d.js";

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
// Tiny lifts above the ground to keep coplanar layers from z-fighting.
const FLAT_Y = -0.4;
const SHADOW_Y = -0.8;

const state = {
  scene: null,
  store: {
    key: "",
    path: [],
    alphabet: LETTERS,
    seed: 1
  }
};

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

// The cast shadow as a building-like TRAIL on the ground: the glyph footprint at
// the feet, its silhouette projected along the light, and the swept band joining
// them — so the shadow streaks out from the base instead of floating as a detached
// copy. The trail's length grows with the letter's height (t = height / light.y).
//
// Drawn OPAQUE (a colour pre-blended toward the shadow tint), which is what lets
// the footprint + band + projected cap overlap freely — even on concave glyphs —
// without the double-darkening translucent fills would give. `softness` lays down
// a wider, translucent halo first that the opaque core then covers bar its rim.
function drawShadow(
  g, p, geometry, k, height, light, fill, softness
) {
  if ( !geometry.contours.length ) {
    return;
  }

  const t = height / Math.max(
    0.06,
    light.y
  );
  const ox = light.x * t;
  const oz = light.z * t;
  const outer = geometry.contours[ 0 ];
  const n = outer.length;

  const cap = (
    offX, offZ, scale, alpha
  ) => {
    g.fill(
      fill[ 0 ],
      fill[ 1 ],
      fill[ 2 ],
      alpha
    );
    g.beginShape( p.TESS );

    for ( const pt of outer ) {
      g.vertex(
        pt.x * k * scale + offX,
        SHADOW_Y,
        pt.y * k * scale + offZ
      );
    }

    g.endShape( p.CLOSE );
  };

  const sweep = (
    scale, alpha
  ) => {
    cap(
      0,
      0,
      scale,
      alpha
    );
    cap(
      ox,
      oz,
      scale,
      alpha
    );

    g.fill(
      fill[ 0 ],
      fill[ 1 ],
      fill[ 2 ],
      alpha
    );
    g.beginShape( p.TRIANGLES );

    for ( let i = 0; i < n; i++ ) {
      const a = outer[ i ];
      const b = outer[ ( i + 1 ) % n ];
      const ax = a.x * k * scale;
      const az = a.y * k * scale;
      const bx = b.x * k * scale;
      const bz = b.y * k * scale;

      g.vertex(
        ax,
        SHADOW_Y,
        az
      );
      g.vertex(
        bx,
        SHADOW_Y,
        bz
      );
      g.vertex(
        bx + ox,
        SHADOW_Y,
        bz + oz
      );
      g.vertex(
        ax,
        SHADOW_Y,
        az
      );
      g.vertex(
        bx + ox,
        SHADOW_Y,
        bz + oz
      );
      g.vertex(
        ax + ox,
        SHADOW_Y,
        az + oz
      );
    }

    g.endShape();
  };

  if ( softness > 0 ) {
    sweep(
      1 + 0.14 * softness,
      110
    );
  }

  sweep(
    1,
    255
  );
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
  clearCapCache();
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
  // Full 0–360 on every axis. rotateX is the eye's pitch as it orbits the reading
  // head (0° = horizon / edge-on, 90° = straight down, and on round the back) —
  // expressed as an orbit so it stays well-defined at every angle. rotateY then
  // spins the grid on the ground and rotateZ rolls the frame.
  const distance = cameraCfg.distance ?? 1300;
  const rotX = p.radians( cameraCfg.rotateX ?? 58 );
  const rotY = p.radians( cameraCfg.rotateY ?? 0 );
  const rotZ = p.radians( cameraCfg.rotateZ ?? 0 );
  const sinX = Math.sin( rotX );
  const cosX = Math.cos( rotX );

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
    -distance * sinX,
    distance * cosX,
    0,
    cameraCfg.lift ?? 0,
    0,
    0,
    -cosX,
    -sinX
  );
  // Un-mirror screen-X; the glyph's depth is pre-flipped in getGlyphGeometry so
  // letters read upright on the ground at the default orientation.
  g.scale(
    -1,
    1,
    1
  );
  // Spin the grid on the ground (Y) and roll the frame (Z) — applied within the
  // pitched view so they compose intuitively on top of the tilt.
  g.rotateY( rotY );
  g.rotateZ( rotZ );

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

  // ── Cast shadows (unlit; opaque trail pre-blended over the ground tint) ────
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
  // Opaque fill = the ground darkened toward the shadow tint by `opacity`. Keeping
  // it opaque is what lets the trail's overlapping parts stack without darkening.
  const shadowFill = lerpColor(
    groundColor,
    shadowColor,
    shadowOpacity
  );

  if ( shadowOpacity > 0 ) {
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
        shadowFill,
        shadowSoftness
      );
      g.pop();
    }
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
