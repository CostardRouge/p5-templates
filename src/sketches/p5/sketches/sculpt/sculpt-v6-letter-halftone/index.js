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
  cursorField,
  sheetCursors,
  packBounds,
  packField,
  textUnits,
  valueNoise2,
  MAX_OFFSET,
  HEIGHT_MAX
} from "../_mesh.js";
import {
  coverageAt,
  loopTurns
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
// sculpt v6 — letter halftone.
//
// No tubes: one DOT per cell, sized by how much ink lies under the cell. The
// mask is read as an AREA (`coverageAt`, supersampled), not as the bit under
// the point, so a cell astride the outline gets a smaller dot and the letter's
// edge reads as a halftone gradient rather than a staircase. Off the ink the
// dots sit at their rest size, a quiet grid; on it they swell until they
// touch, and the smooth union melts the touching ones into one gooey slab —
// which is the sticky look the category is about, without a single link.
//
// The dot grid whose sizes make a picture is the oldest trick in kinetic
// type (Antonin Waterkeyn's Cavalry grids of scaled circles and squares are
// the reference here); the sculpt version adds the fusion, a bob that keeps
// the slab alive, and the handover: each beat the dots shrink and regrow to
// the next character's coverage in an order (`rise.order`), and, if asked,
// each dot turns half a turn as it hands over (`dots.flip`) — which is only
// visible when the dot is a box.
//
// ── What is v6's own ─────────────────────────────────────────────────────────
// • The primitive is `_trace.js`'s ORIENTED_CELL_GLSL: a sphere, or a rounded
//   box (`dots.shape`), with an angle per cell — the box's spin (`dots.spin`,
//   whole turns per loop), a twist across the sheet (`dots.twist`) and the
//   handover flip. `uProp` carries the radius, the angle and an elongation
//   per cell; `uField` the offsets and the height (the lift plus the bob).
// • The radius follows the coverage through `dots.gamma` (a halftone's dot
//   curve) and the handover's easing: an easeOutBack rise pops a dot past
//   its size before it settles.
//
// ── Shared with the category ─────────────────────────────────────────────────
// The grid, the drift, the order and the handover are `_mesh.js`'s; the
// raster `_raster.js`'s; the trace `_trace.js`'s; the camera the shared rig.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Beats per loop are whole, the spin is whole turns, the bob and the drift
// are circles of the loop clock, the hue scroll whole periods: progression 1
// renders progression 0, cursor lag aside.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 112;
// The widest dot the packing allows, in cells: past this a dot from the
// scan's outer ring could reach the sample's cell unseen.
const RADIUS_CAP = 1;

const FRAGMENT = gridFragment( {
  cell: ORIENTED_CELL_GLSL,
  maxSteps: MAX_STEPS
} );

const halftoneRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// ── Units: the coverage of one mask on one grid ──────────────────────────────
const unitMemo = new Map();
const UNIT_MEMO_MAX = 64;

function buildUnit( {
  mask,
  grid,
  samples,
  gamma,
  rise,
  fall,
  aspect,
  seed
} ) {
  const target = new Float32Array( grid.count );
  const ru = 0.5 / grid.cols;
  const rv = 0.5 / grid.rows;

  for ( let n = 0; n < grid.count; n++ ) {
    const coverage = coverageAt(
      mask,
      grid.u[ n ],
      grid.v[ n ],
      ru,
      rv,
      samples
    );

    target[ n ] = coverage > 0 ? Math.pow(
      coverage,
      gamma
    ) : 0;
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
    order,
    fallOrder
  };
}

function getUnit( cfg ) {
  const key = [
    cfg.mask.key,
    cfg.gridKey,
    cfg.samples,
    cfg.gamma,
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
  size: null,
  heights: null,
  progress: null,
  radius: null,
  angle: null,
  length: null,
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
  state.size = new Float32Array( grid.count );
  state.heights = new Float32Array( grid.count );
  state.progress = new Float32Array( grid.count );
  state.radius = new Float32Array( grid.count );
  state.angle = new Float32Array( grid.count );
  state.length = new Float32Array( grid.count );
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
  const dots = o.dots ?? {};
  const relief = o.relief ?? {};
  const rhythm = o.rhythm ?? {};
  const rise = o.rise ?? {};
  const fall = o.fall ?? {};
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
      Math.round( field.density ?? 36 ),
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
    order: rise.order ?? "sweep",
    angle: rise.angle ?? 0
  };
  const fallCfg = {
    order: fall.order ?? "mirror"
  };
  const prepared = masks.map( ( mask ) => getUnit( {
    mask,
    grid,
    gridKey: state.gridKey,
    samples: clamp(
      Math.round( dots.samples ?? 4 ),
      1,
      8
    ),
    gamma: clamp(
      dots.gamma ?? 1,
      0.2,
      4
    ),
    rise: riseCfg,
    fall: fallCfg,
    aspect,
    seed: fieldCfg.seed
  } ) );

  // ── The beat: coverage per dot, morphing between characters ─────────────
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
      spread: rise.spread ?? 0.7,
      ease: easingFn( rise.easing ?? "easeOutBack" )
    },
    fall: {
      spread: fall.spread ?? rise.spread ?? 0.7,
      ease: easingFn( fall.easing ?? "easeInCubic" ),
      mirror: fallCfg.order === "mirror",
      order: fallCfg.order === "mirror" ? null : state.fallOrders
    }
  };
  const stage = computeHeights(
    prepared,
    tBeats,
    rhythmCfg,
    state.size
  );

  // The flip follows the same stagger as the size.
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

  // ── Cursor: dots swell under the finger, or slide toward it ──────────────
  const cursorMode = cursor.mode ?? "swell";
  const cursorOn = cursorMode !== "off" && interaction.enabled !== false;

  if ( cursorOn ) {
    const cursors = sheetCursors(
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

      if ( cursorMode === "swell" ) {
        state.size[ n ] = Math.min(
          HEIGHT_MAX,
          state.size[ n ] + strength * lag[ n ]
        );
      } else if ( cursors.length ) {
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

  // ── The dots: radius, angle, elongation, and the height they sit at ──────
  const cellMin = cellSize(
    grid,
    aspect
  );
  const restCells = clamp(
    dots.rest ?? 0.1,
    0,
    RADIUS_CAP
  );
  const gainCells = clamp(
    dots.gain ?? 0.38,
    0,
    RADIUS_CAP
  );
  const elongation = clamp(
    dots.elongation ?? 0,
    0,
    1
  );
  const spin = loopTurns(
    progression,
    dots.spin ?? 0
  );
  const twist = dots.twist ?? 0;
  const flip = dots.flip ?? 0;
  const lift = Math.max(
    relief.height ?? 0,
    0
  );
  const bob = dots.bob ?? 0.06;
  const bobCycles = Math.max(
    1,
    Math.round( dots.bobCycles ?? 1 )
  );
  const bobPhase = progression * bobCycles * p.TAU;
  const bobX = Math.cos( bobPhase ) * 1.3;
  const bobY = Math.sin( bobPhase ) * 1.3;
  const bobScale = dots.bobScale ?? 2.5;

  for ( let n = 0; n < grid.count; n++ ) {
    const s = clamp(
      state.size[ n ],
      0,
      HEIGHT_MAX
    );

    // The size is stored as a fraction of the gain, up to HEIGHT_MAX (an
    // easeOutBack overshoot), so the shader's gain is scaled by the same.
    state.radius[ n ] = s / HEIGHT_MAX;
    state.angle[ n ] = spin
      + twist * ( grid.u[ n ] * aspect + grid.v[ n ] )
      + flip * Math.PI * state.progress[ n ];
    state.length[ n ] = elongation;
    // The height: the lift (with the size) and the bob, in world units.
    state.heights[ n ] = lift * Math.min(
      s,
      1
    ) + bob * cellMin * ( valueNoise2(
      grid.u[ n ] * bobScale * aspect + bobX,
      grid.v[ n ] * bobScale + bobY,
      fieldCfg.seed + 401
    ) * 2 - 1 );
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
  const radRest = cellMin * restCells;
  const radGain = cellMin * gainCells * HEIGHT_MAX;
  const lenMax = cellMin;
  const fusion = material.fusion ?? 0.35;
  const smoothK = Math.max(
    cellMin * fusion,
    1e-4
  );
  const maxRadius = radRest + radGain;

  // ── Palette / lighting ───────────────────────────────────────────────────
  const timeScale = o.timeScale ?? 1;
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * timeScale * p.TAU * hueSpread );
  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.7
  );

  halftoneRenderer.render( {
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
        // Heights are already world units.
        height: 1,
        smoothK,
        reachCells: maxRadius / cellMin + elongation + fusion / 4,
        maxRadius: maxRadius + lenMax * elongation,
        extremes,
        scene: "oriented"
      } ),
      uRadRest: radRest,
      uRadGain: radGain,
      uLenMax: lenMax,
      uShape: {
        int: ( dots.shape ?? "sphere" ) === "box" ? 1 : 0
      },
      uRounding: clamp(
        dots.rounding ?? 0.5,
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
