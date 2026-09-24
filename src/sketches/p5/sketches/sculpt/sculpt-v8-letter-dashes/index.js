import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  lightDirFrom
} from "@/p5/utils/braidShader.js";
import {
  cameraBasis,
  cameraUniforms,
  screenRay,
  hitPlaneY
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
  morphProgress,
  squeezeAt,
  cursorField,
  sheetCursors,
  packBounds,
  packField,
  textUnits,
  valueNoise2,
  MAX_OFFSET
} from "../_mesh.js";
import {
  coverageAt,
  distanceAt,
  fieldOf,
  orientationAt,
  lerpOrientation
} from "../_ink.js";
import {
  getMasks
} from "../_raster.js";
import {
  gridFragment,
  gridUniforms,
  cellSize,
  packProps,
  ORIENTED_CELL_GLSL
} from "../_trace.js";

// ─────────────────────────────────────────────────────────────────────────────
// sculpt v8 — letter dashes.
//
// One DASH per cell — a capsule (or a bar) lying on the sheet — and the letter
// is what the dashes point at. On the ink, and for a few cells around it, a
// dash turns to lie ALONG the nearest stroke (the tangent of the mask's
// distance field, `_ink.js` orientationAt), grows to almost a cell, thickens,
// and fuses with the dashes ahead and behind it: the strokes read as
// continuous ribbons of dashes, the counters stay open because nothing
// bridges them. Off the ink the dashes are short and thin and lie in a rest
// field — all one way, radial, a noise, or turning with the loop — the
// compass needles the letter has not reached. It is the grid-of-rotating-
// lines that every Cavalry typography reel leans on (a grid duplicator
// whose rotation is driven by a shape falloff), with the material doing the
// rest.
//
// A handover is a SWING: each dash turns from its current stroke to the next
// letter's, the short way round (`lerpOrientation`), in the rise order, with
// an extra flourish past its target (`dashes.swing`) — and while it turns it
// SHORTENS (`squeeze`), so the letter folds down into needles and unfolds
// into the next one.
//
// ── What is v8's own ─────────────────────────────────────────────────────────
// • Per unit, an angle per point (memoised): where the field's gradient is
//   coherent the stroke's tangent, elsewhere — at a junction, a corner, the
//   medial axis of a fat stroke — the rest field takes over, weighted by the
//   orientation's `strength`. Rest angles are computed every frame because
//   they may turn with the loop.
// • `uProp` carries radius, angle and half-length per cell; the trace is
//   `_trace.js`'s ORIENTED_CELL_GLSL; the cell bound is derived from the
//   longest dash so the 5 × 5 scan stays exact.
// • The cursor is a magnet (`cursor.mode = compass`): dashes within reach
//   turn to point at it, on top of everything else.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Beats per loop are whole, the rest spin is whole half-turns (a dash is the
// same turned by π), the drift a circle of the loop clock, the hue scroll
// whole periods: progression 1 renders progression 0, cursor lag aside.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 112;
// The longest half-dash the packing allows, in cells.
const LENGTH_CAP = 1;

const FRAGMENT = gridFragment( {
  cell: ORIENTED_CELL_GLSL,
  maxSteps: MAX_STEPS
} );

const dashesRenderer = createNoiseFieldRenderer( FRAGMENT );

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

function easingFn( name ) {
  return typeof easing[ name ] === "function" ? easing[ name ] : ( x ) => x;
}

// ── Units: the ink, and the way its strokes run, on one grid ─────────────────
const unitMemo = new Map();
const UNIT_MEMO_MAX = 64;

function buildUnit( {
  mask,
  grid,
  reach,
  rise,
  fall,
  aspect,
  seed
} ) {
  const target = new Float32Array( grid.count );
  const angle = new Float32Array( grid.count );
  const strength = new Float32Array( grid.count );
  const field = fieldOf( mask );
  const ru = 0.5 / grid.cols;
  const rv = 0.5 / grid.rows;
  // The orientation is read over a cross a cell wide.
  const radius = 1 / grid.rows;

  for ( let n = 0; n < grid.count; n++ ) {
    const u = grid.u[ n ];
    const v = grid.v[ n ];

    target[ n ] = coverageAt(
      mask,
      u,
      v,
      ru,
      rv,
      3
    );

    const d = distanceAt(
      mask,
      grid,
      u,
      v
    );

    if ( d > reach ) {
      strength[ n ] = 0;
      continue;
    }

    const o = orientationAt(
      field,
      mask,
      u,
      v,
      radius,
      aspect
    );

    angle[ n ] = o.angle;
    // Beyond the ink the alignment fades with the distance.
    strength[ n ] = o.strength * ( d <= 0 ? 1 : clamp(
      1 - d / Math.max(
        reach,
        1e-3
      ),
      0,
      1
    ) );
  }

  const order = orderValues(
    grid,
    target,
    {
      mode: rise.order,
      angle: rise.angle,
      seed,
      aspect
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
        aspect
      }
    )
    : null;

  return {
    target,
    angle,
    strength,
    order,
    fallOrder
  };
}

function getUnit( cfg ) {
  const key = [
    cfg.mask.key,
    cfg.gridKey,
    cfg.reach,
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

// ── Per-instance state ───────────────────────────────────────────────────────
const state = sketch.state( () => ( {
  gridKey: null,
  grid: null,
  offX: null,
  offZ: null,
  on: null,
  progress: null,
  rest: null,
  angle: null,
  radius: null,
  length: null,
  heights: null,
  field: null,
  props: null,
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
  state.on = new Float32Array( grid.count );
  state.progress = new Float32Array( grid.count );
  state.rest = new Float32Array( grid.count );
  state.angle = new Float32Array( grid.count );
  state.radius = new Float32Array( grid.count );
  state.length = new Float32Array( grid.count );
  state.heights = new Float32Array( grid.count );
  state.field = new Uint8Array( grid.count * 4 );
  state.props = new Uint8Array( grid.count * 4 );
  state.bounds = new Uint8Array( grid.count * 4 );
  state.cursorTarget = new Float32Array( grid.count );
  state.cursorLag = new Float32Array( grid.count );

  return grid;
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
  const dashes = o.dashes ?? {};
  const relief = o.relief ?? {};
  const rhythm = o.rhythm ?? {};
  const rise = o.rise ?? {};
  const fall = o.fall ?? {};
  const squeeze = o.squeeze ?? {};
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
  const masks = getMasks(
    units,
    {
      fontName: text.font ?? "multicoloure",
      size: text.size ?? 0.78,
      weight: text.weight ?? 0,
      offset: text.offset,
      aspect
    }
  );

  if ( !masks ) {
    return;
  }

  // ── The sheet ────────────────────────────────────────────────────────────
  const fieldCfg = {
    density: clamp(
      Math.round( field.density ?? 34 ),
      12,
      96
    ),
    layout: field.layout ?? "grid",
    jitter: field.jitter ?? 0,
    seed: Math.round( field.seed ?? 7 )
  };
  const grid = ensureGrid(
    fieldCfg,
    aspect
  );
  const riseCfg = {
    order: rise.order ?? "reading",
    angle: rise.angle ?? 0
  };
  const fallCfg = {
    order: fall.order ?? "mirror"
  };
  const reach = Math.max(
    dashes.reach ?? 1.5,
    0
  );
  const prepared = masks.map( ( mask ) => getUnit( {
    mask,
    grid,
    gridKey: state.gridKey,
    reach,
    rise: riseCfg,
    fall: fallCfg,
    aspect,
    seed: fieldCfg.seed
  } ) );

  // ── The beat: how "on" each dash is, and how far it has swung ────────────
  const repeats = Math.max(
    1,
    Math.round( rhythm.repeats ?? 1 )
  );
  const tBeats = progression * units.length * repeats;

  state.fallOrders.length = 0;

  for ( const unit of prepared ) {
    state.fallOrders.push( unit.fallOrder );
  }

  const rhythmCfg = {
    hold: rhythm.hold ?? 0.4,
    transition: rhythm.transition ?? "morph",
    rise: {
      spread: rise.spread ?? 0.6,
      ease: easingFn( rise.easing ?? "easeOutCubic" )
    },
    fall: {
      spread: fall.spread ?? rise.spread ?? 0.6,
      ease: easingFn( fall.easing ?? "easeInOutCubic" ),
      mirror: fallCfg.order === "mirror",
      order: fallCfg.order === "mirror" ? null : state.fallOrders
    }
  };
  const stage = computeHeights(
    prepared,
    tBeats,
    rhythmCfg,
    state.on
  );

  morphProgress(
    prepared,
    tBeats,
    rhythmCfg,
    state.progress
  );

  // ── Offsets: jitter plus the loop-clock drift ────────────────────────────
  driftOffsets(
    grid,
    {
      amount: field.drift ?? 0,
      scale: field.driftScale ?? 1,
      cycles: field.driftCycles ?? 1,
      seed: fieldCfg.seed,
      progression
    },
    state.offX,
    state.offZ
  );

  // ── The rest field: where a dash lies when no letter holds it ────────────
  const restMode = dashes.rest ?? "flat";
  const restAngle = dashes.restAngle ?? 0;
  const spinHalfTurns = Math.round( dashes.spin ?? 0 );
  const spin = progression * spinHalfTurns * Math.PI;
  const restScale = dashes.restScale ?? 2;

  for ( let n = 0; n < grid.count; n++ ) {
    const u = grid.u[ n ];
    const v = grid.v[ n ];
    let base;

    switch ( restMode ) {
      case "radial":
        base = Math.atan2(
          v - 0.5,
          ( u - 0.5 ) * aspect
        );
        break;
      case "rings":
        base = Math.atan2(
          v - 0.5,
          ( u - 0.5 ) * aspect
        ) + Math.PI / 2;
        break;
      case "noise":
        base = valueNoise2(
          u * restScale * aspect,
          v * restScale,
          fieldCfg.seed + 501
        ) * Math.PI * 2;
        break;
      default:
        base = 0;
    }

    state.rest[ n ] = base + restAngle + spin;
  }

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

  // ── Cursor: a magnet the dashes point at, or a pull ──────────────────────
  const cursorMode = cursor.mode ?? "compass";
  const cursorOn = cursorMode !== "off" && interaction.enabled !== false;
  let cursors = [];

  if ( cursorOn ) {
    cursors = sheetCursors(
      getPointerGroups( interaction ),
      basis,
      p.width,
      p.height,
      aspect,
      {
        screenRay,
        hitPlaneY
      }
    );

    cursorField(
      grid,
      state.offX,
      state.offZ,
      cursors,
      cursor.radius ?? 0.25,
      easingFn( cursor.falloff ?? "easeOutQuad" ),
      aspect,
      state.cursorTarget
    );

    const follow = 1 - clamp(
      cursor.lag ?? 0.5,
      0,
      0.95
    );
    const lag = state.cursorLag;

    for ( let n = 0; n < grid.count; n++ ) {
      lag[ n ] += ( state.cursorTarget[ n ] - lag[ n ] ) * follow;

      if ( lag[ n ] < 1e-4 ) {
        lag[ n ] = 0;
      }
    }
  } else if ( state.cursorLag ) {
    state.cursorLag.fill( 0 );
  }

  // ── The dashes: angle, length, radius per cell ───────────────────────────
  const a = prepared[ stage.current ];
  const b = prepared[ stage.next ];
  const swing = dashes.swing ?? 0.6;
  const lengthOn = clamp(
    dashes.length ?? 0.9,
    0,
    LENGTH_CAP
  );
  const lengthRest = clamp(
    dashes.restLength ?? 0.28,
    0,
    LENGTH_CAP
  );
  const lift = Math.max(
    relief.height ?? 0,
    0
  );
  const squeezeNow = squeezeAt(
    stage.q,
    clamp(
      squeeze.amount ?? 0.5,
      0,
      0.95
    ),
    clamp(
      squeeze.overshoot ?? 0.15,
      0,
      1
    )
  );
  const cursorStrength = cursor.strength ?? 0.8;

  for ( let n = 0; n < grid.count; n++ ) {
    const rest = state.rest[ n ];
    // Each unit's angle for this point: its stroke where the alignment is
    // coherent, the rest field elsewhere, blended by the strength.
    const angA = a.strength[ n ] > 0
      ? lerpOrientation(
        rest,
        a.angle[ n ],
        a.strength[ n ]
      )
      : rest;
    const angB = b.strength[ n ] > 0
      ? lerpOrientation(
        rest,
        b.angle[ n ],
        b.strength[ n ]
      )
      : rest;
    const s = state.progress[ n ];
    let angle = lerpOrientation(
      angA,
      angB,
      s
    ) + swing * Math.sin( Math.PI * s ) * ( s > 0 && s < 1 ? 1 : 0 );

    // The magnet: within reach, turn toward the nearest cursor.
    if ( cursorMode === "compass" && state.cursorLag[ n ] > 0 && cursors.length ) {
      const i = n % grid.cols;
      const j = ( n - i ) / grid.cols;
      const u = ( i + 0.5 + state.offX[ n ] ) / grid.cols;
      const v = ( j + 0.5 + state.offZ[ n ] ) / grid.rows;
      let best = cursors[ 0 ];
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

      angle = lerpOrientation(
        angle,
        Math.atan2(
          best.v - v,
          ( best.u - u ) * aspect
        ),
        clamp(
          state.cursorLag[ n ] * cursorStrength,
          0,
          1
        )
      );
    } else if ( cursorMode === "attract" && state.cursorLag[ n ] > 0 && cursors.length ) {
      const i = n % grid.cols;
      const j = ( n - i ) / grid.cols;
      const u = ( i + 0.5 + state.offX[ n ] ) / grid.cols;
      const v = ( j + 0.5 + state.offZ[ n ] ) / grid.rows;
      const c = cursors[ 0 ];
      const pull = cursorStrength * state.cursorLag[ n ] * 0.5;

      state.offX[ n ] = clamp(
        state.offX[ n ] + ( c.u - u ) * grid.cols * pull,
        -MAX_OFFSET,
        MAX_OFFSET
      );
      state.offZ[ n ] = clamp(
        state.offZ[ n ] + ( c.v - v ) * grid.rows * pull,
        -MAX_OFFSET,
        MAX_OFFSET
      );
    }

    const on = clamp(
      state.on[ n ],
      0,
      1
    );

    state.angle[ n ] = angle;
    state.radius[ n ] = on;
    state.length[ n ] = ( lengthRest + ( lengthOn - lengthRest ) * on ) * squeezeNow / LENGTH_CAP;
    state.heights[ n ] = lift * on;
  }

  packProps(
    grid,
    state.radius,
    state.angle,
    state.length,
    state.props
  );
  packField(
    grid,
    state.offX,
    state.offZ,
    state.heights,
    state.field
  );

  const extremes = packBounds(
    grid,
    state.heights,
    state.bounds
  );

  // ── Material, in world units derived from the cell ───────────────────────
  const cellMin = cellSize(
    grid,
    aspect
  );
  const radRest = cellMin * clamp(
    dashes.restRadius ?? 0.06,
    0,
    0.5
  ) * squeezeNow;
  const radGain = cellMin * clamp(
    dashes.radius ?? 0.16,
    0,
    0.5
  ) * squeezeNow;
  const lenMax = cellMin * LENGTH_CAP;
  const fusion = material.fusion ?? 0.4;
  const smoothK = Math.max(
    cellMin * fusion,
    1e-4
  );
  const widest = 1 + clamp(
    squeeze.overshoot ?? 0.15,
    0,
    1
  );
  const maxRadius = ( radRest + radGain ) * widest;
  const maxHalf = lenMax * Math.max(
    lengthOn,
    lengthRest
  ) * widest;

  // ── Palette / lighting ───────────────────────────────────────────────────
  const timeScale = o.timeScale ?? 1;
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * timeScale * p.TAU * hueSpread );
  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.7
  );

  dashesRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    textures: {
      uField: {
        data: state.field,
        width: grid.cols,
        height: grid.rows
      },
      uProp: {
        data: state.props,
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
      ...gridUniforms( {
        grid,
        aspect,
        height: 1,
        smoothK,
        reachCells: ( maxRadius + maxHalf ) / cellMin + fusion / 4,
        maxRadius,
        extremes,
        scene: "oriented"
      } ),
      uRadRest: radRest,
      uRadGain: radGain,
      uLenMax: lenMax,
      uShape: {
        int: ( dashes.shape ?? "capsule" ) === "bar" ? 1 : 0
      },
      uRounding: clamp(
        dashes.rounding ?? 0.4,
        0,
        1
      ),
      ...cameraUniforms( basis ),
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.6,
      uPipeHueShift: colors.pipeHueShift ?? 0.6,
      uShimmer: colors.shimmer ?? 1.6,
      uSaturation: colors.saturation ?? 0.8,
      uBrightness: colors.brightness ?? 1.25,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.75,
      uSpecular: light.specular ?? 1.1,
      uSpecPower: light.specPower ?? 42,
      uFresnelPower: light.fresnelPower ?? 2.2,
      uRimStrength: light.rimStrength ?? 0.6,
      uLook: {
        int: ( material.look ?? "tube" ) === "fringe" ? 1 : 0
      },
      uFringeWidth: Math.max(
        material.fringeWidth ?? 1,
        0.05
      ),
      uFringeGlow: material.fringeGlow ?? 3,
      uFringeBody: material.fringeBody ?? 0.1,
      uShadowSoft: 0,
      uFogDensity: camera.fogDensity ?? 0.05,
      uFogStart: basis.distance,
      uMaxDist: basis.distance + 2 * sheetRadius + 2 * lift + 2,
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
