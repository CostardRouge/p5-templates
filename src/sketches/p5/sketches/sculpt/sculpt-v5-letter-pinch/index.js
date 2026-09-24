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
  linkWeights,
  packBounds,
  packField,
  textUnits,
  MAX_OFFSET,
  HEIGHT_MIN,
  HEIGHT_MAX,
  WEIGHT_MAX
} from "../_mesh.js";
import {
  coverageAt,
  inkAt,
  pinchOffsets
} from "../_ink.js";
import {
  getMasks
} from "../_raster.js";
import {
  gridFragment,
  gridUniforms,
  cellSize,
  LINKS_CELL_GLSL
} from "../_trace.js";

// ─────────────────────────────────────────────────────────────────────────────
// sculpt v5 — letter pinch.
//
// A sheet of points joined by thin tubes, as v2 — but the letter does not
// push the sheet UP, it pulls the sheet IN. Every point within reach of the
// ink slides toward it: from outside, toward the outline; from inside, toward
// the stroke's own axis. The mesh contracts onto the letter, its spacing
// shrinks where the ink is and stays at rest everywhere else, and the tubes
// between contracted points thicken and fuse — the letter reads as a knot
// pulled tight in a net (`_ink.js`, pinchOffsets). The Cavalry way of saying
// the same thing is a shape falloff driving a grid duplicator's position:
// Antonin Waterkeyn's kinetic type is full of grids that condense onto a
// glyph and relax off it, and this is that gesture in the sculpt material.
//
// Each beat hands over to the next character: the points slide from one
// letter's pinch to the next one's, in an order and with an easing (the
// same stagger v2 uses for its heights, `morphProgress`), and while they
// travel the MATERIAL SQUEEZES — every radius dips to a fraction of itself
// at the middle of the handover and, if asked, pops past its size before it
// settles (`squeezeAt`). That is the beat: pinch, hold, squeeze, release.
//
// ── What is v5's own ─────────────────────────────────────────────────────────
// • The pinch is a distance-field gesture: the mask's signed distance
//   (`_ink.js`, an exact Euclidean transform memoised per glyph) gives every
//   point how far it is from the ink and which way the ink lies. Outside,
//   the pull fades over `pinch.reach` cells and never crosses the outline;
//   inside, it follows the gradient to the medial axis, where the gradient
//   dies and the pull with it. A point never leaves the middle 90 % of its
//   cell (MAX_OFFSET), which is what keeps the shader's cell scan exact.
// • The relief is optional (`relief.height`, 0 by default): the letter is
//   the contraction, not a lift. The heights still run — they are what
//   thickens the tubes on the ink (a link's weight is the lower of its two
//   ends) — the sheet just stays flat unless asked.
// • `uSqueeze` scales every radius in the shader; the air margin and the
//   slab are computed at the widest the squeeze can make anything.
//
// ── Shared with the category ─────────────────────────────────────────────────
// The grid, the drift, the order, the handover and the links come from
// `_mesh.js`; the raster from `_raster.js`; the trace (the 5 × 5 scan, the
// wall bound, the air ceiling) from `_trace.js`, which is v2's, factored;
// the camera from `utils/cameraRig.js`. The cursor is v2's too, in its
// `attract` mode by default: the sheet sticks to the pointer and the tubes
// stretch after it — the gooey pull the maintainer asked to keep.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Beats per loop = characters × repeats (whole), the drift is a circle of the
// loop clock, the hue scroll is whole periods, the camera motion whole
// cycles, the squeeze is 1 at both ends of a handover: progression 1
// renders progression 0, cursor lag aside.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 112;

const FRAGMENT = gridFragment( {
  cell: LINKS_CELL_GLSL,
  maxSteps: MAX_STEPS
} );

const pinchRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// ── Units: what one mask does to the grid ────────────────────────────────────
// Per unit: the target (the ink's coverage under each point, so an edge point
// counts for part), the pinch offsets, how much each point moved, and the
// orders the rise and fall follow. Memoised on every input.
const unitMemo = new Map();
const UNIT_MEMO_MAX = 64;

function buildUnit( {
  mask,
  grid,
  pinch,
  rise,
  fall,
  aspect,
  seed
} ) {
  const target = new Float32Array( grid.count );
  const moved = new Float32Array( grid.count );
  const pinchX = new Float32Array( grid.count );
  const pinchZ = new Float32Array( grid.count );
  const ru = 0.5 / grid.cols;
  const rv = 0.5 / grid.rows;

  for ( let n = 0; n < grid.count; n++ ) {
    target[ n ] = coverageAt(
      mask,
      grid.u[ n ],
      grid.v[ n ],
      ru,
      rv,
      3
    );
  }

  pinchOffsets(
    grid,
    mask,
    {
      pull: pinch.pull,
      reach: pinch.reach,
      inside: pinch.inside,
      falloff: easingFn( pinch.falloff )
    },
    pinchX,
    pinchZ,
    moved
  );

  // The set that moves is ordered — the ink and the ring it pulls in.
  const ordered = new Float32Array( grid.count );

  for ( let n = 0; n < grid.count; n++ ) {
    ordered[ n ] = Math.max(
      target[ n ],
      moved[ n ]
    );
  }

  const order = orderValues(
    grid,
    ordered,
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
      ordered,
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
    ordered,
    order,
    fallOrder,
    pinchX,
    pinchZ
  };
}

function getUnit( cfg ) {
  const key = [
    cfg.mask.key,
    cfg.gridKey,
    cfg.pinch.pull,
    cfg.pinch.reach,
    cfg.pinch.inside,
    cfg.pinch.falloff,
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
  driftX: null,
  driftZ: null,
  heights: null,
  progress: null,
  field: null,
  links: null,
  bounds: null,
  cursorTarget: null,
  cursorLag: null,
  fallOrders: [],
  morphUnits: []
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
  state.driftX = new Float32Array( grid.count );
  state.driftZ = new Float32Array( grid.count );
  state.heights = new Float32Array( grid.count );
  state.progress = new Float32Array( grid.count );
  state.field = new Uint8Array( grid.count * 4 );
  state.links = new Uint8Array( grid.count * 4 );
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
  const pinch = o.pinch ?? {};
  const relief = o.relief ?? {};
  const rhythm = o.rhythm ?? {};
  const rise = o.rise ?? {};
  const fall = o.fall ?? {};
  const squeeze = o.squeeze ?? {};
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

  // Font still loading: background only until it resolves.
  if ( !masks ) {
    return;
  }

  // ── The sheet ────────────────────────────────────────────────────────────
  const fieldCfg = {
    density: clamp(
      Math.round( field.density ?? 40 ),
      12,
      96
    ),
    layout: field.layout ?? "grid",
    jitter: field.jitter ?? 0.1,
    seed: Math.round( field.seed ?? 7 )
  };
  const grid = ensureGrid(
    fieldCfg,
    aspect
  );
  const pinchCfg = {
    pull: clamp(
      pinch.pull ?? 0.45,
      0,
      MAX_OFFSET
    ),
    reach: pinch.reach ?? 2.5,
    inside: clamp(
      pinch.inside ?? 1,
      0,
      1
    ),
    falloff: pinch.falloff ?? "easeInOutSine"
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
    pinch: pinchCfg,
    rise: riseCfg,
    fall: fallCfg,
    aspect,
    seed: fieldCfg.seed
  } ) );

  // ── The beat: heights (for the tube weights), then the pinch morph ───────
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
      ease: easingFn( rise.easing ?? "easeOutBack" )
    },
    fall: {
      spread: fall.spread ?? rise.spread ?? 0.6,
      ease: easingFn( fall.easing ?? "easeInCubic" ),
      mirror: fallCfg.order === "mirror",
      order: fallCfg.order === "mirror" ? null : state.fallOrders
    }
  };
  const stage = computeHeights(
    prepared,
    tBeats,
    rhythmCfg,
    state.heights
  );

  // The pinch travels between units on the ORDERED set (the ink plus the
  // ring it pulls in), staggered like the heights.
  state.morphUnits.length = 0;

  for ( const unit of prepared ) {
    state.morphUnits.push( {
      target: unit.ordered,
      order: unit.order
    } );
  }

  morphProgress(
    state.morphUnits,
    tBeats,
    rhythmCfg,
    state.progress
  );

  // ── Offsets: the pinch, lerped, plus the loop-clock drift ────────────────
  driftOffsets(
    grid,
    {
      amount: field.drift ?? 0.05,
      scale: field.driftScale ?? 1,
      cycles: field.driftCycles ?? 1,
      seed: fieldCfg.seed,
      progression
    },
    state.driftX,
    state.driftZ
  );

  const a = prepared[ stage.current ];
  const b = prepared[ stage.next ];

  for ( let n = 0; n < grid.count; n++ ) {
    const s = state.progress[ n ];
    const px = a.pinchX[ n ] + ( b.pinchX[ n ] - a.pinchX[ n ] ) * s;
    const pz = a.pinchZ[ n ] + ( b.pinchZ[ n ] - a.pinchZ[ n ] ) * s;

    // The pinch already carries the jitter; the drift is added on top.
    state.offX[ n ] = clamp(
      px + state.driftX[ n ] - grid.jx[ n ],
      -MAX_OFFSET,
      MAX_OFFSET
    );
    state.offZ[ n ] = clamp(
      pz + state.driftZ[ n ] - grid.jz[ n ],
      -MAX_OFFSET,
      MAX_OFFSET
    );
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

  // ── Cursor: the sheet sticks to the pointer ──────────────────────────────
  const cursorMode = cursor.mode ?? "attract";
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
      maxLength: links.maxLength ?? 1.9,
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
  const thickness = cellMin * ( material.thickness ?? 0.35 );
  const tubeRest = thickness * ( links.restWeight ?? 0.35 );
  const tubeGain = thickness * ( links.gain ?? 0.3 );
  const bead = cellMin * ( field.bead ?? 0.12 );
  const fusion = material.fusion ?? 0.3;
  const smoothK = Math.max(
    cellMin * fusion,
    1e-4
  );
  const height = Math.max(
    relief.height ?? 0,
    0
  );
  const squeezeNow = squeezeAt(
    stage.q,
    clamp(
      squeeze.amount ?? 0.6,
      0,
      0.95
    ),
    clamp(
      squeeze.overshoot ?? 0.25,
      0,
      1
    )
  );
  // Bounds at the widest the squeeze can make anything, for the widest tube
  // THIS frame (a link's weight never exceeds the sheet's highest point).
  const widest = 1 + clamp(
    squeeze.overshoot ?? 0.25,
    0,
    1
  );
  const maxRadius = Math.max(
    bead,
    tubeRest + tubeGain * clamp(
      extremes.max,
      0,
      WEIGHT_MAX
    )
  ) * widest;

  // ── Palette / lighting ───────────────────────────────────────────────────
  const timeScale = o.timeScale ?? 1;
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * timeScale * p.TAU * hueSpread );
  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.7
  );

  pinchRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
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
      ...gridUniforms( {
        grid,
        aspect,
        height,
        smoothK,
        reachCells: maxRadius / cellMin + fusion / 4,
        maxRadius,
        extremes,
        scene: "links"
      } ),
      uBead: bead,
      uTubeRest: tubeRest,
      uTubeGain: tubeGain,
      uSqueeze: squeezeNow,
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
