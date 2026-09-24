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
  distanceAt,
  fieldOf,
  gradientAt,
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
// sculpt v9 — letter ripple.
//
// The letter is a STONE dropped in the sheet. Every point knows its distance
// to the ink (`_ink.js`, the mask's signed distance field), and that distance
// is a rank: rings of raised, thickened tubes travel outward from the glyph
// — or inward to it — through the mesh, `ripple.rings` of them per loop,
// spaced `ripple.spacing` cells apart and fading over `ripple.reach`, while
// the ink itself holds as a plateau. As a crest passes it also PUSHES the
// points along the field's gradient (`ripple.push`), so the mesh breathes
// away from the letter and settles back: the sticky stretch of the tubes
// happens across the whole sheet, in waves. It is Cavalry's distance
// falloff with a repeating offset, the staple of every generative-type reel
// (a glyph radiating rings of duplicates), rebuilt on the sculpt material.
//
// Each beat the stone changes: the plateau morphs to the next character in
// an order (`_mesh.js`, computeHeights), and the distance field the rings
// read is blended from the current letter's to the next one's with the same
// easing, so the rings bend from one glyph's outline to the next without a
// cut.
//
// ── What is v9's own ─────────────────────────────────────────────────────────
// • Per unit (memoised): the coverage plateau, the signed distance per point
//   in cells, and the unit gradient (which way is away from the ink).
// • The ripple is a raised-cosine crest over `ripple.width` of its period,
//   evaluated per point from the blended distance — no state, whole rings
//   per loop, so a headless export closes.
// • The links use the `endpoints` rule by default: rings cross the counters
//   of a letter, and the `ink` rule would cut them there.
// • The cursor is a second stone (`cursor.mode = source`): rings radiate
//   from the pointer too, on top of the letter's.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Beats per loop are whole, the rings per loop whole, the drift a circle of
// the loop clock, the hue scroll whole periods, the camera motion whole
// cycles: progression 1 renders progression 0, cursor lag aside.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 112;

const FRAGMENT = gridFragment( {
  cell: LINKS_CELL_GLSL,
  maxSteps: MAX_STEPS
} );

const rippleRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// A crest over the first `width` of a period: 0 → 1 → 0, raised cosine.
function crest(
  phase, width
) {
  const f = ( ( phase % 1 ) + 1 ) % 1;

  return f < width ? 0.5 - 0.5 * Math.cos( ( 2 * Math.PI * f ) / width ) : 0;
}

// ── Units: the plateau, the distance and the way out of one mask ─────────────
const unitMemo = new Map();
const UNIT_MEMO_MAX = 64;
const gradScratch = new Float32Array( 2 );

function buildUnit( {
  mask,
  grid,
  rise,
  fall,
  aspect,
  seed
} ) {
  const target = new Float32Array( grid.count );
  const dist = new Float32Array( grid.count );
  const dirU = new Float32Array( grid.count );
  const dirV = new Float32Array( grid.count );
  const field = fieldOf( mask );
  const ru = 0.5 / grid.cols;
  const rv = 0.5 / grid.rows;

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
    dist[ n ] = Math.min(
      distanceAt(
        mask,
        grid,
        u,
        v
      ),
      1e3
    );

    gradientAt(
      field,
      mask,
      u,
      v,
      gradScratch
    );

    const g = Math.hypot(
      gradScratch[ 0 ],
      gradScratch[ 1 ]
    );

    dirU[ n ] = g > 1e-6 ? gradScratch[ 0 ] / g : 0;
    dirV[ n ] = g > 1e-6 ? gradScratch[ 1 ] / g : 0;
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
    dist,
    dirU,
    dirV,
    order,
    fallOrder
  };
}

function getUnit( cfg ) {
  const key = [
    cfg.mask.key,
    cfg.gridKey,
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
  plateau: null,
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
  state.plateau = new Float32Array( grid.count );
  state.heights = new Float32Array( grid.count );
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
  const ripple = o.ripple ?? {};
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
  const masks = getMasks(
    units,
    {
      fontName: text.font ?? "multicoloure",
      size: text.size ?? 0.6,
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
      Math.round( field.density ?? 44 ),
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
    rise: riseCfg,
    fall: fallCfg,
    aspect,
    seed: fieldCfg.seed
  } ) );

  // ── The beat: the plateau morphs, the distance field blends ──────────────
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
        spread: rise.spread ?? 0.5,
        ease: easingFn( rise.easing ?? "easeOutBack" )
      },
      fall: {
        spread: fall.spread ?? rise.spread ?? 0.5,
        ease: easingFn( fall.easing ?? "easeInCubic" ),
        mirror: fallCfg.order === "mirror",
        order: fallCfg.order === "mirror" ? null : state.fallOrders
      }
    },
    state.plateau
  );
  const blend = easingFn( ripple.blendEasing ?? "easeInOutSine" )( stage.q );
  const a = prepared[ stage.current ];
  const b = prepared[ stage.next ];

  // ── Offsets: jitter plus the loop-clock drift, then the push ─────────────
  driftOffsets(
    grid,
    {
      amount: field.drift ?? 0.04,
      scale: field.driftScale ?? 1,
      cycles: field.driftCycles ?? 1,
      seed: fieldCfg.seed,
      progression
    },
    state.offX,
    state.offZ
  );

  // ── The rings ────────────────────────────────────────────────────────────
  const rings = Math.max(
    1,
    Math.round( ripple.rings ?? 2 )
  );
  const spacing = Math.max(
    ripple.spacing ?? 6,
    0.5
  );
  const reach = Math.max(
    ripple.reach ?? 16,
    0.5
  );
  const width = clamp(
    ripple.width ?? 0.55,
    0.05,
    1
  );
  const inward = ( ripple.direction ?? "out" ) === "in";
  const decayPow = Math.max(
    ripple.decay ?? 1,
    0
  );
  const rippleHeight = ripple.height ?? 0.3;
  const push = clamp(
    ripple.push ?? 0.3,
    0,
    MAX_OFFSET
  );
  const inkHeight = relief.height ?? 0.22;
  const through = ripple.through !== false;
  const travel = progression * rings;

  for ( let n = 0; n < grid.count; n++ ) {
    const d = a.dist[ n ] + ( b.dist[ n ] - a.dist[ n ] ) * blend;
    const plateau = clamp(
      state.plateau[ n ],
      0,
      HEIGHT_MAX
    );
    let h = plateau * inkHeight;

    // Rings outside the ink (and, if asked, through it: a ring keeps its
    // phase across the plateau, which is what makes a counter ripple too).
    const distance = d > 0 ? d : ( through ? -d : -1 );

    if ( distance >= 0 && distance < reach ) {
      const phase = inward ? travel + distance / spacing : travel - distance / spacing;
      const bumpNow = crest(
        phase,
        width
      ) * Math.pow(
        1 - distance / reach,
        decayPow
      );

      h += bumpNow * rippleHeight * ( d > 0 ? 1 : 1 - plateau );

      if ( push > 0 && d > 0 ) {
        // Away from the ink outward, toward it inward.
        const sign = inward ? -1 : 1;
        const du = ( a.dirU[ n ] + ( b.dirU[ n ] - a.dirU[ n ] ) * blend ) * sign;
        const dv = ( a.dirV[ n ] + ( b.dirV[ n ] - a.dirV[ n ] ) * blend ) * sign;

        state.offX[ n ] = clamp(
          state.offX[ n ] + du * push * bumpNow,
          -MAX_OFFSET,
          MAX_OFFSET
        );
        state.offZ[ n ] = clamp(
          state.offZ[ n ] + dv * push * bumpNow,
          -MAX_OFFSET,
          MAX_OFFSET
        );
      }
    }

    state.heights[ n ] = h;
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

  // ── Cursor: a second stone, or a hand under the sheet ────────────────────
  const cursorMode = cursor.mode ?? "source";
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
      cursor.radius ?? 0.3,
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
        // A source: rings radiate from the nearest cursor, within its reach.
        const i = n % grid.cols;
        const j = ( n - i ) / grid.cols;
        const u = ( i + 0.5 + state.offX[ n ] ) / grid.cols;
        const v = ( j + 0.5 + state.offZ[ n ] ) / grid.rows;
        let bestDist = Infinity;

        for ( const c of cursors ) {
          bestDist = Math.min(
            bestDist,
            Math.hypot(
              ( c.u - u ) * aspect,
              c.v - v
            )
          );
        }

        const cells = bestDist * grid.rows;
        const phase = inward ? travel + cells / spacing : travel - cells / spacing;

        state.heights[ n ] = Math.min(
          HEIGHT_MAX,
          state.heights[ n ] + strength * lag[ n ] * crest(
            phase,
            width
          )
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
      reach: links.reach ?? "4",
      rule: links.rule ?? "endpoints",
      maxLength: links.maxLength ?? 1.9,
      // The skirt of hairlines a crest hangs down to the sheet is dropped:
      // the rings are the subject.
      maxRise: links.maxRise ?? 0.1,
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
  const thickness = cellMin * ( material.thickness ?? 0.4 );
  const tubeRest = thickness * ( links.restWeight ?? 0.06 );
  const tubeGain = thickness * ( links.gain ?? 0.6 );
  const bead = cellMin * ( field.bead ?? 0.14 );
  const fusion = material.fusion ?? 0.45;
  const smoothK = Math.max(
    cellMin * fusion,
    1e-4
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

  rippleRenderer.render( {
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
        // Heights are already world units.
        height: 1,
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
      uMaxDist: basis.distance + 2 * sheetRadius + 2 * ( inkHeight + rippleHeight ) + 2,
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
