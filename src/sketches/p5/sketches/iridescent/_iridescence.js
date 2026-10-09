import animation from "@/p5/utils/animation.js";
import mappers from "@/p5/utils/mappers.js";
import easing from "@/p5/utils/easing.js";
import {
  EASING_IDS
} from "@/p5/utils/easingGlsl.js";

import {
  materialFormValues,
  backgroundFormValues,
  renderingFormValues
} from "./_form.js";

// ─────────────────────────────────────────────────────────────────────────────
// The iridescent material — the runtime half. The form half (values, control
// descriptions) is `_form.js`, which imports nothing; THIS module reaches the
// p5 runtime and is only ever imported by a sketch's `index.js`.
//
// The look: a LOOPING colour ramp (a handful of stops, wrapping back to the
// first) read by the angle between the surface and the camera. A patch facing
// the lens reads the ramp's start, the rim reads `bands` cycles further, and
// the whole ramp drifts a whole number of cycles per loop — so colours sweep
// across a shape as it turns and as time passes, the way thin-film
// iridescence (soap, oil, a beetle's shell) changes hue with the viewing
// angle. A directional term offsets the ramp on the lit side so the two sides
// of a shape never read the same colour, each sketch feeds one `structure`
// channel of its own (terrain height, ring depth) so the structure shows
// through the bands, and two offset terms — a static stagger and a travelling
// wave along any coordinate of the structure — let the bands be laid out and
// propagated by hand. Every term has a selectable formula and easing curve;
// `_form.js` documents how they combine.
//
// Rendering is spikeMeshGpu.js (the mesh sketches) or noiseFieldGpu.js (the
// raymarched v4): this module only owns the fragment GLSL, the ramp bake (a
// 1D texture, so the stops can be anything the form holds), and the per-frame
// uniforms.
// ─────────────────────────────────────────────────────────────────────────────

export {
  materialFormValues,
  backgroundFormValues,
  renderingFormValues
};

export const RAMP_WIDTH = 256;

const FOLDS = {
  wrap: 0,
  mirror: 1
};

const COMBINES = {
  add: 0,
  multiply: 1
};

// The easing keys of utils/easing.js are the GLSL function names of
// easingGlsl.js; two have no function of their own.
function easingCall( key ) {
  if ( key === "smoothstep" ) {
    return "(u * u * (3.0 - 2.0 * u))";
  }

  if ( !key || key === "linear" || !( key in EASING_IDS ) ) {
    return "u";
  }

  return `${ key }(u)`;
}

const AXIS_GLSL = {
  index: "cell.z",
  column: "cell.x",
  row: "cell.y",
  x: "(p.x + 0.5)",
  y: "(p.y + 0.5)",
  z: "(p.z + 0.5)",
  radial: "length(around)",
  distance: "length(p)",
  angle: "(atan(around.y, around.x) / TAU + 0.5)"
};

const FACING_GLSL = {
  angle: "acos(cosine) / (PI * 0.5)",
  cosine: "1.0 - cosine",
  fresnel: "pow(1.0 - cosine, uFacingPower)",
  inverse: "1.0 - acos(cosine) / (PI * 0.5)"
};

const WAVE_GLSL = {
  sine: "0.5 + 0.5 * sin(TAU * phase)",
  triangle: "1.0 - abs(2.0 * fract(phase) - 1.0)",
  saw: "fract(phase)"
};

/**
 * What the material's GLSL is specialised on: every select and every curve.
 * The choices are baked into the shader rather than read from uniforms — a
 * uniform `if` chain over 31 easings, five times per fragment, cost 5× the
 * whole material under software GL, and a shader permutation costs one
 * compile per change of a dropdown.
 */
export function materialVariant( material ) {
  const d = materialFormValues;
  const m = material ?? d;
  const ramp = m.ramp ?? d.ramp;
  const facing = m.facing ?? d.facing;
  const light = m.light ?? d.light;
  const structure = m.structure ?? d.structure;
  const stagger = m.stagger ?? d.stagger;
  const wave = m.wave ?? d.wave;

  const variant = {
    fold: ramp.fold in FOLDS ? ramp.fold : d.ramp.fold,
    combine: m.combine in COMBINES ? m.combine : d.combine,
    facingFormula: facing.formula in FACING_GLSL ? facing.formula : d.facing.formula,
    facingCurve: facing.curve ?? d.facing.curve,
    lightCurve: light.curve ?? d.light.curve,
    structureCurve: structure.curve ?? d.structure.curve,
    stagger: ( stagger.weight ?? d.stagger.weight ) !== 0,
    staggerAxis: stagger.axis in AXIS_GLSL ? stagger.axis : d.stagger.axis,
    staggerCurve: stagger.curve ?? d.stagger.curve,
    wave: ( wave.weight ?? d.wave.weight ) !== 0,
    waveAxis: wave.axis in AXIS_GLSL ? wave.axis : d.wave.axis,
    waveShape: wave.shape in WAVE_GLSL ? wave.shape : d.wave.shape,
    waveCurve: wave.curve ?? d.wave.curve
  };

  return {
    ...variant,
    key: Object.values( variant ).join( "|" )
  };
}

/**
 * The material's fragment GLSL for one variant. Needs, declared before it:
 * PI and TAU, and the easing functions of easingGlsl.js (which both
 * renderers inject). Defines `iridescentShade( n, v, dist, cell, pos,
 * structure )` and spikeMeshGpu's `shade( … )` entry point.
 */
export function iridescentShadeGlsl( variant ) {
  const v = variant ?? materialVariant( null );
  const foldGlsl = v.fold === "mirror"
    ? "u = 1.0 - abs(1.0 - 2.0 * u);"
    : "";
  const combineGlsl = v.combine === "multiply"
    ? `float shape = mix(1.0, tFacing, uFacingWeight)
      * mix(1.0, tLight, uLightWeight)
      * mix(1.0, tStructure, uStructureWeight);`
    : "float shape = tFacing * uFacingWeight + tLight * uLightWeight + tStructure * uStructureWeight;";
  const staggerGlsl = v.stagger
    ? `{
      float u = fract(${ AXIS_GLSL[ v.staggerAxis ] } * uStaggerCycles);
      offset += uStaggerWeight * ${ easingCall( v.staggerCurve ) };
    }`
    : "";
  const waveGlsl = v.wave
    ? `{
      float phase = ${ AXIS_GLSL[ v.waveAxis ] } * uWaveCycles - uWavePhase;
      float u = ${ WAVE_GLSL[ v.waveShape ] };
      offset += uWaveWeight * ${ easingCall( v.waveCurve ) };
    }`
    : "";

  return `
  uniform sampler2D uRamp;
  uniform float uRampWidth;
  uniform float uBands;
  uniform float uShift;

  uniform float uFacingWeight;
  uniform float uFacingPower;

  uniform float uLightWeight;
  uniform vec3  uLightDir;     // view space, the way the light travels
  uniform float uLightWrap;

  uniform float uStructureWeight;

  uniform float uStaggerWeight;
  uniform float uStaggerCycles;

  uniform float uWaveWeight;
  uniform float uWaveCycles;
  uniform float uWavePhase;    // wavelengths travelled so far this loop

  uniform float uShading;
  uniform vec3  uFogColor;
  uniform float uFogAmount;
  uniform float uFogStart;
  uniform float uFogEnd;

  uniform float uSceneScale;   // the structure's size, in the sketch's units
  uniform int   uAxisMode;     // 0: the main axis is y, 1: it is z

  // The ramp, looping, interpolated by hand between texels so the lookup is
  // the same whether the texture was bound LINEAR + REPEAT (spikeMeshGpu) or
  // NEAREST + CLAMP (noiseFieldGpu's data textures).
  vec3 rampColor(float x) {
    float u = fract(x);

    ${ foldGlsl }

    float s  = u * uRampWidth - 0.5;
    float i0 = floor(s);
    float f  = s - i0;
    float x0 = (mod(i0, uRampWidth) + 0.5) / uRampWidth;
    float x1 = (mod(i0 + 1.0, uRampWidth) + 0.5) / uRampWidth;

    return mix(texture2D(uRamp, vec2(x0, 0.5)).rgb, texture2D(uRamp, vec2(x1, 0.5)).rgb, f);
  }

  // n: the normal, facing the camera; v: the direction to the eye — both in
  // view space (x right, y down, z toward the eye, p5's WEBGL convention);
  // dist: distance from the eye for the fog; cell: (column, row, index) as
  // 0..1 fractions; pos: the point in the sketch's own units; structure: the
  // sketch's own 0..1 channel.
  vec3 iridescentShade(vec3 n, vec3 v, float dist, vec3 cell, vec3 pos, float structure) {
    vec3 p = pos / max(uSceneScale, 1e-6);
    vec2 around = uAxisMode == 1 ? p.xy : p.xz;

    float cosine = clamp(abs(dot(n, v)), 0.0, 1.0);
    float facing = ${ FACING_GLSL[ v.facingFormula ] };

    vec3  toLight = normalize(-uLightDir);
    float lambert = dot(n, toLight);
    float lit = clamp((lambert + uLightWrap) / (1.0 + uLightWrap), 0.0, 1.0);

    float tFacing, tLight, tStructure;
    { float u = clamp(facing, 0.0, 1.0);    tFacing    = ${ easingCall( v.facingCurve ) }; }
    { float u = lit;                         tLight     = ${ easingCall( v.lightCurve ) }; }
    { float u = clamp(structure, 0.0, 1.0); tStructure = ${ easingCall( v.structureCurve ) }; }

    ${ combineGlsl }

    float offset = 0.0;
    ${ staggerGlsl }
    ${ waveGlsl }

    vec3 c = rampColor(shape * uBands + offset + uShift);

    c *= mix(1.0, clamp(lambert * 0.5 + 0.5, 0.0, 1.0), uShading);

    float fog = clamp((dist - uFogStart) / max(uFogEnd - uFogStart, 1e-4), 0.0, 1.0) * uFogAmount;

    return mix(c, uFogColor, fog);
  }

  // spikeMeshGpu's material entry point.
  vec3 shade(vec3 n, vec3 v, vec3 viewPos, vec3 cell, vec3 pos, float structure) {
    return iridescentShade(n, v, length(viewPos), cell, pos, structure);
  }
`;
}

function channel(
  color, index, fallback
) {
  const v = Array.isArray( color ) ? color[ index ] : undefined;

  return Number.isFinite( v ) ? v : fallback;
}

function clamp01( v ) {
  return Math.max(
    0,
    Math.min(
      1,
      v
    )
  );
}

/**
 * Bake the ramp stops into one row of RGBA bytes, looping (the last stop
 * blends back into the first). `hardness` pinches each transition towards a
 * flat band: 0 is a smoothstep between neighbours, 1 is nearly hard edges.
 *
 * @param {number[][]} stops [r, g, b] 0–255 each
 * @param {number} hardness 0–1
 * @returns {{ key: string, width: number, bytes: Uint8Array }}
 */
export function bakeRamp(
  stops, hardness
) {
  const list = Array.isArray( stops ) && stops.length > 0
    ? stops
    : materialFormValues.ramp.stops;
  const n = list.length;
  const h = clamp01( hardness );
  const gain = 1 / ( 1 - 0.96 * h );
  const bytes = new Uint8Array( RAMP_WIDTH * 4 );

  for ( let i = 0; i < RAMP_WIDTH; i++ ) {
    const s = ( ( i + 0.5 ) / RAMP_WIDTH ) * n;
    const k = Math.floor( s );
    const f = s - k;
    const c0 = list[ k % n ];
    const c1 = list[ ( k + 1 ) % n ];

    let g = clamp01( ( f - 0.5 ) * gain + 0.5 );

    g = g * g * ( 3 - 2 * g );

    for ( let ch = 0; ch < 3; ch++ ) {
      const a = channel(
        c0,
        ch,
        0
      );
      const b = channel(
        c1,
        ch,
        0
      );

      bytes[ i * 4 + ch ] = Math.round( a + ( b - a ) * g );
    }

    bytes[ i * 4 + 3 ] = 255;
  }

  return {
    key: `${ h.toFixed( 3 ) }|${ list.map( ( c ) => [
      channel(
        c,
        0,
        0
      ),
      channel(
        c,
        1,
        0
      ),
      channel(
        c,
        2,
        0
      )
    ].join( "," ) ).join( ";" ) }`,
    width: RAMP_WIDTH,
    bytes
  };
}

const rampCache = {
  key: null,
  ramp: null
};

function rampFor( material ) {
  const stops = material?.ramp?.stops;
  const hardness = material?.ramp?.hardness ?? materialFormValues.ramp.hardness;
  const key = `${ hardness }|${ JSON.stringify( stops ?? null ) }`;

  if ( rampCache.key !== key ) {
    rampCache.key = key;
    rampCache.ramp = bakeRamp(
      stops,
      hardness
    );
  }

  return rampCache.ramp;
}

function rgb01( color ) {
  return [
    channel(
      color,
      0,
      0
    ) / 255,
    channel(
      color,
      1,
      0
    ) / 255,
    channel(
      color,
      2,
      0
    ) / 255
  ];
}

/**
 * The material's render() inputs for this frame.
 *
 * @param {object} material the sketch's `material` options
 * @param {object} background the sketch's `background` options (fog colour)
 * @param {object} [scene] { scale, axis } — the structure's size in the
 *   sketch's units (normalises the position axes) and its main axis ("y" or
 *   "z") for the angle / radial coordinates
 * @returns {{ ramp: object, shade: { key: string, glsl: string }, uniforms: object }}
 *   `shade` is the material's fragment GLSL for the current variant (its
 *   selects and curves are baked in) with a key that changes with it, so a
 *   renderer rebuilds its program only when one of those changes.
 */
export function materialRender(
  material, background, {
    scale = 500,
    axis = "y"
  } = {}
) {
  const d = materialFormValues;
  const m = material ?? d;
  const ramp = m.ramp ?? d.ramp;
  const facing = m.facing ?? d.facing;
  const light = m.light ?? d.light;
  const structure = m.structure ?? d.structure;
  const stagger = m.stagger ?? d.stagger;
  const wave = m.wave ?? d.wave;
  const fog = m.fog ?? d.fog;

  const dir = light.direction ?? d.light.direction;
  const len = Math.hypot(
    dir.x ?? 0,
    dir.y ?? 0,
    dir.z ?? 0
  );
  const lightDir = len > 1e-6
    ? [
      dir.x / len,
      dir.y / len,
      dir.z / len
    ]
    : [
      0,
      0,
      -1
    ];

  // Whole cycles per loop, so the drift closes; its curve reshapes the
  // journey through the loop but still lands on the same phase.
  const phase = animation.progression;
  const cycles = Math.round( ramp.cyclesPerLoop ?? d.ramp.cyclesPerLoop );
  const driftFn = easing?.[ ramp.driftCurve ?? d.ramp.driftCurve ] ?? easing.linear ?? ( ( t ) => t );
  const shift = ( ramp.offset ?? d.ramp.offset ) - cycles * mappers.fn(
    phase,
    0,
    1,
    0,
    1,
    driftFn
  );
  const waveSpeed = Math.round( wave.speed ?? d.wave.speed );

  const variant = materialVariant( m );

  return {
    ramp: rampFor( m ),
    shade: {
      key: variant.key,
      glsl: iridescentShadeGlsl( variant )
    },
    uniforms: {
      uRampWidth: RAMP_WIDTH,
      uBands: ramp.bands ?? d.ramp.bands,
      uShift: shift,

      uFacingWeight: facing.weight ?? d.facing.weight,
      uFacingPower: facing.power ?? d.facing.power,

      uLightWeight: light.weight ?? d.light.weight,
      uLightDir: lightDir,
      uLightWrap: light.wrap ?? d.light.wrap,

      uStructureWeight: structure.weight ?? d.structure.weight,

      uStaggerWeight: stagger.weight ?? d.stagger.weight,
      uStaggerCycles: stagger.cycles ?? d.stagger.cycles,

      uWaveWeight: wave.weight ?? d.wave.weight,
      uWaveCycles: wave.cycles ?? d.wave.cycles,
      uWavePhase: waveSpeed * phase,

      uShading: m.shading ?? d.shading,
      uFogColor: rgb01( background?.bottom ?? backgroundFormValues.bottom ),
      uFogAmount: fog.amount ?? d.fog.amount,
      uFogStart: fog.start ?? d.fog.start,
      uFogEnd: fog.end ?? d.fog.end,

      uSceneScale: scale,
      uAxisMode: {
        int: axis === "z" ? 1 : 0
      }
    }
  };
}

/**
 * The rendering block → spikeMeshGpu tessellation + supersampling.
 */
export function renderingSettings(
  rendering, {
    spikeRings = 48,
    spikeSegments = 24,
    bodyRings = 48,
    bodySegments = 64
  } = {}
) {
  const detail = rendering?.detail ?? renderingFormValues.detail;
  const scale = ( v ) => Math.round( v * detail );

  return {
    supersample: Number( rendering?.supersample ?? renderingFormValues.supersample ) || 1,
    spikeMesh: {
      rings: scale( spikeRings ),
      segments: scale( spikeSegments )
    },
    bodyMesh: {
      rings: scale( bodyRings ),
      segments: scale( bodySegments )
    }
  };
}

/**
 * Vertical gradient background on the 2D canvas, under the composited mesh.
 */
export function drawBackground(
  p, background
) {
  const top = background?.top ?? backgroundFormValues.top;
  const bottom = background?.bottom ?? backgroundFormValues.bottom;
  const ctx = p.drawingContext;

  if ( ctx && typeof ctx.createLinearGradient === "function" ) {
    const gradient = ctx.createLinearGradient(
      0,
      0,
      0,
      p.height
    );

    gradient.addColorStop(
      0,
      `rgb(${ channel(
        top,
        0,
        0
      ) }, ${ channel(
        top,
        1,
        0
      ) }, ${ channel(
        top,
        2,
        0
      ) })`
    );
    gradient.addColorStop(
      1,
      `rgb(${ channel(
        bottom,
        0,
        0
      ) }, ${ channel(
        bottom,
        1,
        0
      ) }, ${ channel(
        bottom,
        2,
        0
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

    return;
  }

  p.background( ...bottom );
}

/**
 * The peaks family's wobble (a sine per axis, scaled to ±angleMax), plus
 * whole turns per loop about y so a subject can also spin continuously.
 */
export function wobbleRotation(
  p, rotation, defaults
) {
  const enabled = rotation?.enabled ?? defaults.enabled ?? true;
  const angleMax = rotation?.angleMax ?? defaults.angleMax ?? 0;
  const xMultiplier = rotation?.xMultiplier ?? defaults.xMultiplier ?? 0;
  const yMultiplier = rotation?.yMultiplier ?? defaults.yMultiplier ?? 0;
  const zMultiplier = rotation?.zMultiplier ?? defaults.zMultiplier ?? 0;
  const spinTurns = Math.round( rotation?.spinTurns ?? defaults.spinTurns ?? 0 );

  const wobble = ( value ) => mappers.fn(
    value,
    -1,
    1,
    -angleMax,
    angleMax
  );

  return {
    x: enabled ? wobble( p.sin( animation.angle * xMultiplier ) ) : 0,
    y: ( enabled ? wobble( p.cos( animation.angle * yMultiplier ) ) : 0 )
      + spinTurns * animation.angle,
    z: enabled ? wobble( p.sin( animation.angle * zMultiplier ) ) : 0
  };
}
