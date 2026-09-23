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
  stagger,
  cursorField,
  sheetCursors,
  linkWeights,
  packBounds,
  packField,
  textUnits,
  cellHash01,
  MAX_OFFSET,
  HEIGHT_MIN,
  HEIGHT_MAX,
  WEIGHT_MAX
} from "../_mesh.js";
import {
  inkAt
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
// sculpt v7 — letter slices.
//
// The sheet stays where it is; the INK moves under it, cut into strips. Every
// `slices.band` rows of the grid (or columns) form one strip, and each strip
// reads the letter displaced by its own shift — a wave that runs strip by
// strip along the loop, alternating directions if asked — so the relief that
// rises through the sheet is the letter sliced and sheared, its strips
// sliding past each other and never quite lining up. It is kinetic type's
// oldest cut (a word sliced into bands that slide; every one of Antonin
// Waterkeyn's Cavalry reels has one) done as a relief: the points under each
// strip's ink rise, the tubes between them thicken, and the points on the ink
// are CARRIED sideways with their strip (`slices.carry`, capped so a point
// never leaves its cell), so the mesh itself shears and the tubes between two
// strips stretch across the cut — the sticky part.
//
// The handover is the strips': when a beat ends, the current letter's strips
// scatter — each slides out to one side, in an order (`slices.order`), by
// `slices.scatter` — while the next letter's strips slide in from the other,
// and the heights follow (a crossfade per strip, or one out then the other
// in). Every target is recomputed per frame from the displaced masks, which
// costs one lookup per point per letter and keeps the frame a pure function
// of the loop clock.
//
// ── Shared with the category ─────────────────────────────────────────────────
// The grid, the drift, the links and the cursor are `_mesh.js`'s (v2's
// cursor, `lift` by default); the raster `_raster.js`'s; the trace
// `_trace.js`'s (v2's, factored); the camera the shared rig.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Beats per loop are whole, the strip wave is whole cycles, the drift a
// circle of the loop clock, the hue scroll whole periods, the camera motion
// whole cycles: progression 1 renders progression 0, cursor lag aside.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 112;

const FRAGMENT = gridFragment( {
  cell: LINKS_CELL_GLSL,
  maxSteps: MAX_STEPS
} );

const slicesRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// ── Strips ───────────────────────────────────────────────────────────────────
// The order value of strip k of `count`: 0 goes first.
function stripOrder(
  k, count, mode, seed
) {
  const t = count > 1 ? k / ( count - 1 ) : 0;

  switch ( mode ) {
    case "last-first":
      return 1 - t;
    case "centre-out":
      return Math.abs( t - 0.5 ) * 2;
    case "edges-in":
      return 1 - Math.abs( t - 0.5 ) * 2;
    case "alternate":
      return ( k % 2 ) * 0.5 + t * 0.5;
    case "random":
      return cellHash01(
        k,
        5,
        seed
      );
    default:
      return t;
  }
}

// ── Per-instance state ───────────────────────────────────────────────────────
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
  shiftA: null,
  shiftB: null,
  outA: null,
  inB: null
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

function ensureStrips( count ) {
  if ( !state.shiftA || state.shiftA.length !== count ) {
    state.shiftA = new Float32Array( count );
    state.shiftB = new Float32Array( count );
    state.outA = new Float32Array( count );
    state.inB = new Float32Array( count );
  }
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
  const slices = o.slices ?? {};
  const relief = o.relief ?? {};
  const rhythm = o.rhythm ?? {};
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

  // ── The beat ─────────────────────────────────────────────────────────────
  const repeats = Math.max(
    1,
    Math.round( rhythm.repeats ?? 1 )
  );
  const tBeats = progression * units.length * repeats;
  const count = units.length;
  const beat = ( ( tBeats % count ) + count ) % count;
  const current = Math.floor( beat );
  const next = ( current + 1 ) % count;
  const hold = clamp(
    rhythm.hold ?? 0.4,
    0,
    0.95
  );
  const pBeat = beat - current;
  const q = pBeat < hold ? 0 : ( pBeat - hold ) / ( 1 - hold );
  const maskA = masks[ current ];
  const maskB = masks[ next ];

  // ── The strips and their shifts ──────────────────────────────────────────
  const byRows = ( slices.axis ?? "rows" ) !== "columns";
  const band = clamp(
    Math.round( slices.band ?? 2 ),
    1,
    12
  );
  const stripCount = Math.ceil( ( byRows ? grid.rows : grid.cols ) / band );
  const wave = slices.wave ?? 0.045;
  const cycles = Math.max(
    1,
    Math.round( slices.cycles ?? 1 )
  );
  const phase = slices.phase ?? 0.6;
  const alternate = slices.alternate !== false;
  const scatter = slices.scatter ?? 0.3;
  const orderMode = slices.order ?? "first-last";
  const spread = clamp(
    slices.spread ?? 0.6,
    0,
    0.95
  );
  const transition = rhythm.transition ?? "crossfade";
  const outEase = easingFn( slices.outEasing ?? "easeInCubic" );
  const inEase = easingFn( slices.inEasing ?? "easeOutBack" );

  ensureStrips( stripCount );

  for ( let k = 0; k < stripCount; k++ ) {
    const sign = alternate && ( k % 2 === 1 ) ? -1 : 1;
    const ripple = wave * sign * Math.sin( cycles * progression * p.TAU + k * phase );
    // The scatter direction of a strip: alternating sides, a seeded spread
    // of distances, so the strips fan out rather than march.
    const dir = ( k % 2 === 1 ? -1 : 1 ) * ( 0.6 + 0.8 * cellHash01(
      k,
      3,
      fieldCfg.seed
    ) );
    const order = stripOrder(
      k,
      stripCount,
      orderMode,
      fieldCfg.seed
    );
    let out;
    let into;

    if ( transition === "sequential" ) {
      out = q < 0.5 ? outEase( stagger(
        q * 2,
        order,
        spread
      ) ) : 1;
      into = q < 0.5 ? 0 : inEase( stagger(
        ( q - 0.5 ) * 2,
        order,
        spread
      ) );
    } else {
      out = q > 0 ? outEase( stagger(
        q,
        order,
        spread
      ) ) : 0;
      into = q > 0 ? inEase( stagger(
        q,
        order,
        spread
      ) ) : 0;
    }

    state.outA[ k ] = out;
    state.inB[ k ] = into;
    // The current letter slides out to its side; the next slides in from
    // the other.
    state.shiftA[ k ] = ripple + scatter * dir * out;
    state.shiftB[ k ] = ripple - scatter * dir * ( 1 - into );
  }

  const stripOf = (
    u, v
  ) => Math.min(
    stripCount - 1,
    Math.floor( ( byRows ? v * grid.rows : u * grid.cols ) / band )
  );
  const inkShifted = (
    mask, shift, u, v
  ) => ( byRows
    ? inkAt(
      mask,
      u - shift,
      v
    )
    : inkAt(
      mask,
      u,
      v - shift
    ) );

  // ── Heights: each strip's ink, sliding ───────────────────────────────────
  const profile = relief.profile ?? "flat";
  const carry = clamp(
    slices.carry ?? 1,
    0,
    1
  );

  driftOffsets(
    grid,
    {
      amount: field.drift ?? 0.05,
      scale: field.driftScale ?? 1,
      cycles: field.driftCycles ?? 1,
      seed: fieldCfg.seed,
      progression
    },
    state.offX,
    state.offZ
  );

  for ( let n = 0; n < grid.count; n++ ) {
    const u = grid.u[ n ];
    const v = grid.v[ n ];
    const k = stripOf(
      u,
      v
    );
    const hA = inkShifted(
      maskA,
      state.shiftA[ k ],
      u,
      v
    ) * ( 1 - state.outA[ k ] );
    const hB = inkShifted(
      maskB,
      state.shiftB[ k ],
      u,
      v
    ) * state.inB[ k ];
    let h = Math.max(
      hA,
      hB
    );

    if ( profile === "ramp" ) {
      // Each strip a little higher than the last: a staircase.
      h *= 0.5 + 0.5 * ( stripCount > 1 ? k / ( stripCount - 1 ) : 1 );
    }

    state.heights[ n ] = h;

    // A point on the ink is carried with its strip, as far as its cell allows.
    if ( carry > 0 && h > 0 ) {
      const shift = hA >= hB ? state.shiftA[ k ] : state.shiftB[ k ];
      const cells = shift * ( byRows ? grid.cols : grid.rows ) * carry;

      if ( byRows ) {
        state.offX[ n ] = clamp(
          state.offX[ n ] + cells,
          -MAX_OFFSET,
          MAX_OFFSET
        );
      } else {
        state.offZ[ n ] = clamp(
          state.offZ[ n ] + cells,
          -MAX_OFFSET,
          MAX_OFFSET
        );
      }
    }
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

  // ── Cursor: a hand under (or on) the sheet ───────────────────────────────
  const cursorMode = cursor.mode ?? "lift";
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
  const inTransition = q > 0;

  linkWeights(
    grid,
    state.heights,
    state.offX,
    state.offZ,
    {
      reach: links.reach ?? "4",
      rule: links.rule ?? "ink",
      maxLength: links.maxLength ?? 1.9,
      inkAt: (
        u, v
      ) => {
        const k = stripOf(
          u,
          v
        );

        return inkShifted(
          maskA,
          state.shiftA[ k ],
          u,
          v
        ) || ( inTransition && inkShifted(
          maskB,
          state.shiftB[ k ],
          u,
          v
        ) );
      }
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
  const thickness = cellMin * ( material.thickness ?? 0.45 );
  const tubeRest = thickness * ( links.restWeight ?? 0.1 );
  const tubeGain = thickness * ( links.gain ?? 0.7 );
  const bead = cellMin * ( field.bead ?? 0.15 );
  const fusion = material.fusion ?? 0.45;
  const smoothK = Math.max(
    cellMin * fusion,
    1e-4
  );
  const height = Math.max(
    relief.height ?? 0.3,
    0
  );
  // The widest tube THIS frame: a link's weight never exceeds the sheet's
  // highest point, so a quiet sheet keeps a wide cell bound.
  const maxRadius = Math.max(
    bead,
    tubeRest + tubeGain * clamp(
      extremes.max,
      0,
      WEIGHT_MAX
    )
  );

  // ── Palette / lighting ───────────────────────────────────────────────────
  const timeScale = o.timeScale ?? 1;
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * timeScale * p.TAU * hueSpread );
  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.7
  );

  slicesRenderer.render( {
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
      uSqueeze: 1,
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
