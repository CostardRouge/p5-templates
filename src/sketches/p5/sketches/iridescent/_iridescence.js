import animation from "@/p5/utils/animation.js";
import mappers from "@/p5/utils/mappers.js";

// ─────────────────────────────────────────────────────────────────────────────
// The iridescent material, shared by every sketch in the category.
//
// The look: a LOOPING colour ramp (a handful of stops, wrapping back to the
// first) read by the angle between the surface and the camera. A patch facing
// the lens reads the ramp's start, the rim reads `bands` cycles further, and
// the whole ramp drifts a whole number of cycles per loop — so colours sweep
// across a shape as it turns and as time passes, the way thin-film
// iridescence (soap, oil, a beetle's shell) changes hue with the viewing
// angle. A second, directional term offsets the ramp on the lit side so the
// two sides of a shape never read the same colour, and each sketch feeds one
// `extra` channel of its own (terrain height, ring depth) so the structure
// shows through the bands.
//
// Rendering is spikeMeshGpu.js: this module only owns the fragment GLSL, the
// ramp bake (a 1D texture, so the stops can be anything the form holds), the
// form block and the per-frame uniforms.
// ─────────────────────────────────────────────────────────────────────────────

export const RAMP_WIDTH = 256;

export const IRIDESCENT_SHADE_GLSL = `
  const float IRID_HALF_PI = 1.5707963267948966;

  uniform sampler2D uRamp;
  uniform float uRampWidth;
  uniform float uBands;
  uniform float uShift;
  uniform float uFacingWeight;
  uniform float uLightWeight;
  uniform float uExtraWeight;
  uniform float uShading;
  uniform vec3  uLightDir;     // view space, the way the light travels
  uniform vec3  uFogColor;
  uniform float uFogAmount;
  uniform float uFogStart;
  uniform float uFogEnd;

  // The ramp, looping, interpolated by hand between texels so the lookup is
  // the same whether the texture was bound LINEAR + REPEAT (spikeMeshGpu) or
  // NEAREST + CLAMP (noiseFieldGpu's data textures).
  vec3 rampColor(float x) {
    float u  = fract(x) * uRampWidth - 0.5;
    float i0 = floor(u);
    float f  = u - i0;
    float x0 = (mod(i0, uRampWidth) + 0.5) / uRampWidth;
    float x1 = (mod(i0 + 1.0, uRampWidth) + 0.5) / uRampWidth;

    return mix(texture2D(uRamp, vec2(x0, 0.5)).rgb, texture2D(uRamp, vec2(x1, 0.5)).rgb, f);
  }

  // n: the normal, facing the camera; v: the direction to the eye — both in
  // view space (x right, y down, z toward the eye, p5's WEBGL convention);
  // dist: distance from the eye for the fog; extra: the sketch's own channel.
  vec3 iridescentShade(vec3 n, vec3 v, float dist, float extra) {
    // The angle itself rather than 1 - cos: on a sphere most of the projected
    // area is within 30° of facing the lens, where 1 - cos has hardly moved,
    // so the angle spreads the bands across the shape instead of its rim.
    float facing = acos(clamp(abs(dot(n, v)), 0.0, 1.0)) / IRID_HALF_PI;
    vec3  toLight = normalize(-uLightDir);
    float lit = dot(n, toLight) * 0.5 + 0.5;

    float x = facing * uFacingWeight + lit * uLightWeight + extra * uExtraWeight;
    vec3 c = rampColor(x * uBands + uShift);

    c *= mix(1.0, lit, uShading);

    float fog = clamp((dist - uFogStart) / max(uFogEnd - uFogStart, 1e-4), 0.0, 1.0) * uFogAmount;

    return mix(c, uFogColor, fog);
  }

  // spikeMeshGpu's material entry point.
  vec3 shade(vec3 n, vec3 v, vec3 viewPos, float extra) {
    return iridescentShade(n, v, length(viewPos), extra);
  }
`;

// The reference's palette, in ramp order: blue → green → cream → pink → wine →
// navy, then back to blue. Read off the video frame by frame (centre → rim).
export const materialFormValues = {
  ramp: {
    stops: [
      [
        52,
        72,
        228
      ],
      [
        72,
        150,
        30
      ],
      [
        242,
        232,
        196
      ],
      [
        242,
        84,
        136
      ],
      [
        128,
        6,
        46
      ],
      [
        16,
        18,
        56
      ]
    ],
    hardness: 0.35,
    bands: 0.75,
    offset: 0,
    cyclesPerLoop: 1
  },
  facing: 1,
  light: {
    weight: 0.6,
    direction: {
      x: 0.5,
      y: 0.6,
      z: -0.6
    }
  },
  extra: 0.3,
  shading: 0.12,
  fog: {
    amount: 0,
    start: 400,
    end: 1600
  }
};

export const backgroundFormValues = {
  top: [
    178,
    188,
    206
  ],
  bottom: [
    202,
    210,
    226
  ]
};

export const renderingFormValues = {
  supersample: "2",
  detail: 1
};

/**
 * The `material` form block. `extraLabel` names what the sketch feeds the
 * extra channel with (terrain, height, depth…), since the slider means
 * nothing without it.
 */
export function materialFormConfiguration( {
  extraLabel = "Structure → colour",
  fogRange = {
    max: 4000,
    step: 10
  }
} = {} ) {
  return {
    component: "nested-object",
    label: "Iridescent material",
    fields: {
      ramp: {
        component: "nested-object",
        label: "Colour ramp (loops back to the first stop)",
        fields: {
          stops: {
            label: "Stops, in order",
            component: "item-list",
            minItems: 2,
            maxItems: 12,
            itemConfig: {
              label: "Stop",
              component: "color"
            }
          },
          hardness: {
            label: "Band hardness (0 = soft blend, 1 = flat bands)",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          bands: {
            label: "Ramp cycles from facing the camera to the rim",
            component: "slider",
            min: 0.1,
            max: 4,
            step: 0.05
          },
          offset: {
            label: "Ramp offset (which stop faces the camera)",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          cyclesPerLoop: {
            label: "Colour drift: whole cycles per loop",
            component: "slider",
            min: -4,
            max: 4,
            step: 1
          }
        }
      },
      facing: {
        label: "Facing (rim) weight",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      light: {
        component: "nested-object",
        label: "Directional term",
        fields: {
          weight: {
            label: "Lit-side ramp offset",
            component: "slider",
            min: 0,
            max: 2,
            step: 0.01
          },
          direction: {
            component: "vector3d",
            label: "Light direction (camera space, the way it travels)",
            kind: "direction",
            min: -1,
            max: 1,
            step: 0.01,
            yDown: true
          }
        }
      },
      extra: {
        label: extraLabel,
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      shading: {
        label: "Shading (darken the far side)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fog: {
        component: "nested-object",
        label: "Fog (fades to the background colour)",
        fields: {
          amount: {
            label: "Amount",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          },
          start: {
            label: "Starts at (distance from the eye)",
            component: "slider",
            min: 0,
            max: fogRange.max,
            step: fogRange.step
          },
          end: {
            label: "Full at (distance from the eye)",
            component: "slider",
            min: 0,
            max: fogRange.max,
            step: fogRange.step
          }
        }
      }
    }
  };
}

export const backgroundFormConfiguration = {
  component: "nested-object",
  label: "Background",
  fields: {
    top: {
      component: "color",
      label: "Top"
    },
    bottom: {
      component: "color",
      label: "Bottom"
    }
  }
};

export const renderingFormConfiguration = {
  component: "nested-object",
  label: "Rendering",
  fields: {
    supersample: {
      label: "Antialiasing (supersampling)",
      component: "select",
      options: [
        {
          value: "1",
          label: "Off (1×)"
        },
        {
          value: "2",
          label: "2× (default)"
        },
        {
          value: "3",
          label: "3× (exports)"
        }
      ]
    },
    detail: {
      label: "Mesh detail (quality ↔ speed)",
      component: "slider",
      min: 0.25,
      max: 2,
      step: 0.05
    }
  }
};

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
 * @returns {{ ramp: object, uniforms: object }}
 */
export function materialRender(
  material, background
) {
  const m = material ?? materialFormValues;
  const d = m.light?.direction ?? materialFormValues.light.direction;
  const len = Math.hypot(
    d.x ?? 0,
    d.y ?? 0,
    d.z ?? 0
  );
  const lightDir = len > 1e-6
    ? [
      d.x / len,
      d.y / len,
      d.z / len
    ]
    : [
      0,
      0,
      -1
    ];
  const cycles = Math.round( m.ramp?.cyclesPerLoop ?? materialFormValues.ramp.cyclesPerLoop );
  const shift = ( m.ramp?.offset ?? 0 ) - cycles * animation.progression;
  const fogColor = rgb01( background?.bottom ?? backgroundFormValues.bottom );

  return {
    ramp: rampFor( m ),
    uniforms: {
      uRampWidth: RAMP_WIDTH,
      uBands: m.ramp?.bands ?? materialFormValues.ramp.bands,
      uShift: shift,
      uFacingWeight: m.facing ?? materialFormValues.facing,
      uLightWeight: m.light?.weight ?? materialFormValues.light.weight,
      uLightDir: lightDir,
      uExtraWeight: m.extra ?? materialFormValues.extra,
      uShading: m.shading ?? materialFormValues.shading,
      uFogColor: fogColor,
      uFogAmount: m.fog?.amount ?? 0,
      uFogStart: m.fog?.start ?? materialFormValues.fog.start,
      uFogEnd: m.fog?.end ?? materialFormValues.fog.end
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

export const rotationFormConfiguration = {
  component: "nested-object",
  label: "Rotation",
  fields: {
    enabled: {
      label: "Animated wobble?",
      component: "checkbox"
    },
    angleMax: {
      label: "Wobble amplitude",
      component: "slider",
      min: 0,
      max: Math.PI,
      step: 0.01
    },
    xMultiplier: {
      label: "X wobble speed",
      component: "slider",
      min: -9,
      max: 9,
      step: 1
    },
    yMultiplier: {
      label: "Y wobble speed",
      component: "slider",
      min: -9,
      max: 9,
      step: 1
    },
    zMultiplier: {
      label: "Z wobble speed",
      component: "slider",
      min: -9,
      max: 9,
      step: 1
    },
    spinTurns: {
      label: "Whole turns per loop (around y)",
      component: "slider",
      min: -4,
      max: 4,
      step: 1
    }
  }
};
