// ─────────────────────────────────────────────────────────────────────────────
// Palettes — the named colour looks every palette-aware sketch picks from.
//
// A palette is a LOOPING ramp: a list of stops (with a hardness that pinches
// each transition, from a full-segment blend at 0 to flat bands at 1), or a
// formula id. A formula palette is computed exactly at every texel of the
// baked ramp, so a house colour function (the peaks' `colors.rainbow`, the
// shaders' cosine "oil slick") comes back pixel for pixel rather than as a
// handful of sampled stops — sampling them at 12 stops drifted up to 12/255 a
// channel; the 256-texel bake of the formula stays within rounding (0.5/255).
// Its `stops` are a 24-step sampling, only for the picker's swatch tile.
//
// This module imports NOTHING and holds no p5 code: `options.ts` files read it
// server-side (see sketchOptionsLoad.test.ts), and the runtimes read it too.
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE_RAMP_WIDTH = 256;

const TAU = Math.PI * 2;

function clampByte( v ) {
  return Math.max(
    0,
    Math.min(
      255,
      v
    )
  );
}

/**
 * The house colour functions, x in [0, 1) over one loop of the ramp, returning
 * 0–255 channels.
 *
 * @type {Record<string, (x: number) => number[]>}
 */
export const PALETTE_FORMULAS = {
  // utils/colors.js `rainbow()` with its defaults (Math.sin / Math.cos, 0–360
  // clipped to 255, p5 in RGB mode), hueIndex = x · 2π.
  rainbow: ( x ) => {
    const a = x * TAU;

    return [
      clampByte( ( Math.sin( a ) * 0.5 + 0.5 ) * 360 ),
      clampByte( ( 1 - Math.cos( a ) ) * 0.5 * 360 ),
      clampByte( ( 1 - Math.sin( a ) ) * 0.5 * 360 )
    ];
  },
  // The shaders' `iridescent()` spectrum before its saturation / brightness
  // grading: 0.5 + 0.5 cos(2π (x + (0, 0.33, 0.67))).
  "oil-slick": ( x ) => [
    0,
    0.33,
    0.67
  ].map( ( offset ) => 255 * ( 0.5 + 0.5 * Math.cos( TAU * ( x + offset ) ) ) )
};

/** A formula sampled at `count` steps, rounded — the swatch's stops. */
export function formulaStops(
  formula, count = 24
) {
  const fn = PALETTE_FORMULAS[ formula ];

  return Array.from(
    {
      length: count
    },
    (
      _, k
    ) => fn( k / count ).map( Math.round )
  );
}

function formulaPalette( {
  formula, ...rest
} ) {
  return {
    ...rest,
    formula,
    stops: formulaStops( formula ),
    hardness: 0
  };
}

export const PALETTES = {
  rainbow: formulaPalette( {
    formula: "rainbow",
    label: "Rainbow",
    group: "Classics",
    description: "The peaks sketches' own colors.rainbow — sin / cos sweeps of red, green and blue — computed exactly, on black",
    paper: {
      top: [
        0,
        0,
        0
      ],
      bottom: [
        10,
        10,
        14
      ]
    }
  } ),
  "oil-slick": formulaPalette( {
    formula: "oil-slick",
    label: "Oil slick",
    group: "Classics",
    description: "The cosine spectrum of the shader sketches (flowers, torsade, braid, rings…) — thin-film oil on water — computed exactly, on black",
    paper: {
      top: [
        6,
        6,
        10
      ],
      bottom: [
        18,
        18,
        26
      ]
    }
  } ),
  iridescent: {
    label: "Iridescent",
    group: "Classics",
    description: "The ramp read off the reference video — blue, green, cream, pink, burgundy, navy — on its blue-grey paper",
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
    paper: {
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
    }
  },
  "riso-pink-blue": {
    label: "Riso pink × blue",
    group: "Risograph",
    description: "Fluorescent pink and blue inks, with yellow, the paper and their violet overprint",
    stops: [
      [
        255,
        72,
        176
      ],
      [
        255,
        232,
        0
      ],
      [
        245,
        240,
        230
      ],
      [
        0,
        120,
        191
      ],
      [
        74,
        46,
        126
      ]
    ],
    hardness: 0.92,
    paper: {
      top: [
        245,
        240,
        230
      ],
      bottom: [
        234,
        227,
        212
      ]
    }
  },
  "riso-teal-orange": {
    label: "Riso teal × orange",
    group: "Risograph",
    description: "Teal and orange inks, with mint, the paper and federal blue",
    stops: [
      [
        0,
        131,
        138
      ],
      [
        130,
        216,
        213
      ],
      [
        245,
        240,
        230
      ],
      [
        255,
        108,
        47
      ],
      [
        61,
        85,
        136
      ]
    ],
    hardness: 0.9,
    paper: {
      top: [
        245,
        240,
        230
      ],
      bottom: [
        234,
        227,
        212
      ]
    }
  },
  "riso-sunflower-burgundy": {
    label: "Riso sunflower × burgundy",
    group: "Risograph",
    description: "Sunflower and burgundy inks, with bright red, aqua and the paper",
    stops: [
      [
        255,
        181,
        17
      ],
      [
        241,
        80,
        96
      ],
      [
        145,
        78,
        114
      ],
      [
        94,
        200,
        229
      ],
      [
        245,
        240,
        230
      ]
    ],
    hardness: 0.9,
    paper: {
      top: [
        247,
        241,
        227
      ],
      bottom: [
        236,
        228,
        210
      ]
    }
  },
  "riso-purple-mint": {
    label: "Riso purple × mint",
    group: "Risograph",
    description: "Purple and mint inks, with the paper, fluorescent pink and medium blue",
    stops: [
      [
        118,
        91,
        167
      ],
      [
        130,
        216,
        213
      ],
      [
        245,
        240,
        230
      ],
      [
        255,
        72,
        176
      ],
      [
        50,
        85,
        164
      ]
    ],
    hardness: 0.9,
    paper: {
      top: [
        245,
        240,
        230
      ],
      bottom: [
        234,
        227,
        212
      ]
    }
  },
  "acid-y2k": {
    label: "Acid Y2K",
    group: "Looks",
    description: "Chartreuse, ink black, ultraviolet, hot pink and chrome",
    stops: [
      [
        200,
        255,
        0
      ],
      [
        13,
        13,
        18
      ],
      [
        106,
        0,
        255
      ],
      [
        255,
        46,
        147
      ],
      [
        217,
        222,
        230
      ]
    ],
    hardness: 0.55,
    paper: {
      top: [
        21,
        21,
        27
      ],
      bottom: [
        38,
        38,
        47
      ]
    }
  },
  "liquid-chrome": {
    label: "Liquid chrome",
    group: "Looks",
    description: "Mirror greys on graphite",
    stops: [
      [
        244,
        246,
        248
      ],
      [
        154,
        163,
        173
      ],
      [
        43,
        47,
        54
      ],
      [
        201,
        209,
        218
      ],
      [
        92,
        101,
        112
      ],
      [
        230,
        235,
        240
      ]
    ],
    hardness: 0.1,
    paper: {
      top: [
        26,
        29,
        34
      ],
      bottom: [
        46,
        51,
        59
      ]
    }
  },
  "holo-foil": {
    label: "Holo foil",
    group: "Looks",
    description: "Pastel rainbow and steel on graphite",
    stops: [
      [
        255,
        154,
        213
      ],
      [
        159,
        231,
        255
      ],
      [
        201,
        255,
        158
      ],
      [
        255,
        229,
        138
      ],
      [
        185,
        163,
        255
      ],
      [
        110,
        122,
        150
      ]
    ],
    hardness: 0.05,
    paper: {
      top: [
        42,
        46,
        56
      ],
      bottom: [
        59,
        64,
        77
      ]
    }
  },
  "beetle-shell": {
    label: "Beetle shell",
    group: "Looks",
    description: "A deep oil slick on black",
    stops: [
      [
        8,
        26,
        51
      ],
      [
        14,
        124,
        107
      ],
      [
        127,
        227,
        166
      ],
      [
        242,
        193,
        78
      ],
      [
        181,
        23,
        158
      ],
      [
        58,
        12,
        163
      ]
    ],
    hardness: 0.15,
    paper: {
      top: [
        7,
        9,
        15
      ],
      bottom: [
        21,
        27,
        41
      ]
    }
  },
  thermal: {
    label: "Thermal",
    group: "Looks",
    description: "A thermal camera, from night to white heat",
    stops: [
      [
        6,
        6,
        26
      ],
      [
        58,
        12,
        163
      ],
      [
        194,
        24,
        91
      ],
      [
        255,
        111,
        0
      ],
      [
        255,
        214,
        0
      ],
      [
        255,
        255,
        240
      ]
    ],
    hardness: 0.2,
    paper: {
      top: [
        11,
        11,
        20
      ],
      bottom: [
        30,
        30,
        46
      ]
    }
  },
  vaporwave: {
    label: "Vaporwave",
    group: "Looks",
    description: "Neon pink, violet, cyan, mint and lemon on dusk",
    stops: [
      [
        255,
        113,
        206
      ],
      [
        185,
        103,
        255
      ],
      [
        1,
        205,
        254
      ],
      [
        5,
        255,
        161
      ],
      [
        255,
        251,
        150
      ]
    ],
    hardness: 0.3,
    paper: {
      top: [
        26,
        16,
        51
      ],
      bottom: [
        51,
        32,
        79
      ]
    }
  },
  cyanotype: {
    label: "Cyanotype",
    group: "Looks",
    description: "Prussian blue print on rag paper",
    stops: [
      [
        11,
        45,
        91
      ],
      [
        31,
        95,
        160
      ],
      [
        141,
        184,
        222
      ],
      [
        246,
        241,
        228
      ],
      [
        169,
        201,
        230
      ],
      [
        46,
        111,
        176
      ]
    ],
    hardness: 0.5,
    paper: {
      top: [
        243,
        238,
        223
      ],
      bottom: [
        229,
        221,
        200
      ]
    }
  },
  seventies: {
    label: "Seventies",
    group: "Looks",
    description: "Terracotta, mustard, sage and petrol",
    stops: [
      [
        226,
        112,
        58
      ],
      [
        242,
        193,
        78
      ],
      [
        244,
        233,
        216
      ],
      [
        107,
        143,
        113
      ],
      [
        46,
        74,
        98
      ],
      [
        158,
        61,
        47
      ]
    ],
    hardness: 0.75,
    paper: {
      top: [
        244,
        233,
        216
      ],
      bottom: [
        232,
        219,
        195
      ]
    }
  },
  bauhaus: {
    label: "Bauhaus",
    group: "Looks",
    description: "Primaries, black and paper, in flat bands",
    stops: [
      [
        230,
        57,
        70
      ],
      [
        242,
        237,
        228
      ],
      [
        241,
        196,
        15
      ],
      [
        29,
        78,
        137
      ],
      [
        17,
        17,
        17
      ]
    ],
    hardness: 1,
    paper: {
      top: [
        242,
        237,
        228
      ],
      bottom: [
        230,
        223,
        208
      ]
    }
  }
};

function channel(
  color, index
) {
  const v = Array.isArray( color ) ? color[ index ] : undefined;

  return Number.isFinite( v ) ? v : 0;
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
 * Bake a palette into one row of RGBA bytes, looping (the last stop blends
 * back into the first). A `formula` is evaluated at each texel centre; stops
 * are blended with a smoothstep whose width the hardness narrows from a full
 * segment (0) to 4 % of one (1).
 *
 * @param {{ stops?: number[][], hardness?: number, formula?: string }} palette
 * @returns {{ key: string, width: number, bytes: Uint8Array }}
 */
export function bakePaletteRamp( {
  stops, hardness = 0, formula
} = {} ) {
  const bytes = new Uint8Array( PALETTE_RAMP_WIDTH * 4 );
  const fn = formula ? PALETTE_FORMULAS[ formula ] : null;

  if ( fn ) {
    for ( let i = 0; i < PALETTE_RAMP_WIDTH; i++ ) {
      const rgb = fn( ( i + 0.5 ) / PALETTE_RAMP_WIDTH );

      for ( let ch = 0; ch < 3; ch++ ) {
        bytes[ i * 4 + ch ] = Math.round( rgb[ ch ] );
      }

      bytes[ i * 4 + 3 ] = 255;
    }

    return {
      key: `formula:${ formula }`,
      width: PALETTE_RAMP_WIDTH,
      bytes
    };
  }

  const list = Array.isArray( stops ) && stops.length > 0
    ? stops
    : [
      [
        0,
        0,
        0
      ]
    ];
  const n = list.length;
  const h = clamp01( hardness );
  const gain = 1 / ( 1 - 0.96 * h );

  for ( let i = 0; i < PALETTE_RAMP_WIDTH; i++ ) {
    const s = ( ( i + 0.5 ) / PALETTE_RAMP_WIDTH ) * n;
    const k = Math.floor( s );
    const f = s - k;
    const c0 = list[ k % n ];
    const c1 = list[ ( k + 1 ) % n ];

    let g = clamp01( ( f - 0.5 ) * gain + 0.5 );

    g = g * g * ( 3 - 2 * g );

    for ( let ch = 0; ch < 3; ch++ ) {
      const a = channel(
        c0,
        ch
      );
      const b = channel(
        c1,
        ch
      );

      bytes[ i * 4 + ch ] = Math.round( a + ( b - a ) * g );
    }

    bytes[ i * 4 + 3 ] = 255;
  }

  return {
    key: `${ h.toFixed( 3 ) }|${ list.map( ( c ) => [
      channel(
        c,
        0
      ),
      channel(
        c,
        1
      ),
      channel(
        c,
        2
      )
    ].join( "," ) ).join( ";" ) }`,
    width: PALETTE_RAMP_WIDTH,
    bytes
  };
}

/** The presets as picker options (`{ value, label, group, stops, … }`). */
export const PALETTE_PRESET_OPTIONS = Object.entries( PALETTES ).map( ( [
  value,
  palette
] ) => ( {
  value,
  ...palette
} ) );

// ── Shader sketches (the cosine `iridescent()` spectrum) ─────────────────────
// "original" is the sketch's own cosine spectrum, untouched: the GLSL keeps
// its exact arithmetic on that branch, so a document without a palette — and
// every published /embed — renders the same pixels as before. A preset
// replaces the spectrum only; the sketch's hue spread / phase / speed still
// walk the ramp, and its saturation and brightness still grade the result.
// The background is the sketch's own unless "use the palette's background"
// is ticked (off by default): these sketches have ONE background colour, so
// the paper's two colours are averaged into it.

export const SHADER_PALETTE_OPTIONS = [
  {
    value: "original",
    label: "Original",
    group: "Your own",
    description: "The sketch's own oil-slick spectrum, graded by the sliders below",
    stops: formulaStops( "oil-slick" ),
    hardness: 0
  },
  // Oil slick IS the original here, so it is not listed twice.
  ...PALETTE_PRESET_OPTIONS.filter( ( option ) => option.value !== "oil-slick" )
];

export const shaderPaletteFormValues = {
  palette: "original",
  paletteBackground: false
};

export const shaderPaletteFormFields = {
  palette: {
    label: "Palette",
    component: "palette-picker",
    options: SHADER_PALETTE_OPTIONS
  },
  paletteBackground: {
    label: "Use the palette's background",
    component: "checkbox"
  }
};

function presetFor( id ) {
  return id && id !== "original" ? PALETTES[ id ] ?? null : null;
}

/**
 * The background colour a shader sketch should clear to: its own, unless the
 * palette's is asked for and the palette has one (then the paper's two colours
 * averaged, keeping the sketch's own alpha).
 */
export function shaderPaletteBackground(
  colors, background
) {
  const preset = presetFor( colors?.palette );

  if ( !colors?.paletteBackground || !preset?.paper ) {
    return background;
  }

  const {
    top, bottom = top
  } = preset.paper;
  const mixed = [
    0,
    1,
    2
  ].map( ( i ) => Math.round( ( channel(
    top,
    i
  ) + channel(
    bottom,
    i
  ) ) / 2 ) );

  return Array.isArray( background ) && background.length > 3
    ? [
      ...mixed,
      background[ 3 ]
    ]
    : mixed;
}

const NO_RAMP = {
  data: new Uint8Array( [
    0,
    0,
    0,
    255
  ] ),
  width: 1,
  height: 1
};
const shaderRampCache = new Map();

/**
 * What a shader sketch hands its renderer for the palette this frame: the
 * `uPaletteRamp` data texture and the `uPaletteOn` switch read by
 * `PALETTE_IRIDESCENT_GLSL` (braidShader.js). Ramps are baked once per palette
 * id, so a binding cycling the palettes costs one bake each, then an upload.
 *
 * @returns {{
 *   textures: { uPaletteRamp: { data: Uint8Array, width: number, height: number } },
 *   uniforms: { uPaletteOn: number }
 * }}
 */
export function shaderPalette( colors ) {
  const id = colors?.palette;
  const preset = presetFor( id );

  if ( !preset ) {
    return {
      textures: {
        uPaletteRamp: NO_RAMP
      },
      uniforms: {
        uPaletteOn: 0
      }
    };
  }

  let ramp = shaderRampCache.get( id );

  if ( !ramp ) {
    const baked = bakePaletteRamp( preset );

    ramp = {
      data: baked.bytes,
      width: baked.width,
      height: 1
    };
    shaderRampCache.set(
      id,
      ramp
    );
  }

  return {
    textures: {
      uPaletteRamp: ramp
    },
    uniforms: {
      uPaletteOn: 1
    }
  };
}
