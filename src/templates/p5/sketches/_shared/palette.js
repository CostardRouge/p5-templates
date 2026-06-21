// Shared helpers reused across generative categories (metaballs, voronoi, …).
// This folder is "_"-prefixed so the sketch scanner never treats it as a
// category. Keeps palettes/PRNG in one place instead of copy-pasting them.

/* ------------------------------------------------------------------ */
/*  Deterministic PRNG (mulberry32)                                   */
/* ------------------------------------------------------------------ */

export function mulberry32( seed ) {
  let a = ( seed >>> 0 ) || 1;

  return function() {
    a |= 0;
    a = ( a + 0x6D2B79F5 ) | 0;

    let t = Math.imul(
      a ^ ( a >>> 15 ),
      1 | a
    );

    t = ( t + Math.imul(
      t ^ ( t >>> 7 ),
      61 | t
    ) ) ^ t;

    return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  IQ cosine palettes — return [r,g,b] in 0..255                     */
/* ------------------------------------------------------------------ */

const PALETTES = {
  rainbow: [
    [
      0.5,
      0.5,
      0.5
    ],
    [
      0.5,
      0.5,
      0.5
    ],
    [
      1,
      1,
      1
    ],
    [
      0,
      0.33,
      0.67
    ]
  ],
  sunset: [
    [
      0.5,
      0.5,
      0.5
    ],
    [
      0.5,
      0.5,
      0.5
    ],
    [
      1,
      1,
      1
    ],
    [
      0,
      0.1,
      0.2
    ]
  ],
  fire: [
    [
      0.5,
      0.2,
      0.1
    ],
    [
      0.6,
      0.3,
      0.2
    ],
    [
      1,
      1,
      1
    ],
    [
      0,
      0.15,
      0.3
    ]
  ],
  ice: [
    [
      0.4,
      0.5,
      0.6
    ],
    [
      0.3,
      0.4,
      0.5
    ],
    [
      1,
      1,
      1
    ],
    [
      0.6,
      0.75,
      0.9
    ]
  ],
  magma: [
    [
      0.4,
      0.2,
      0.4
    ],
    [
      0.5,
      0.3,
      0.4
    ],
    [
      1,
      1,
      1
    ],
    [
      0.1,
      0.25,
      0.55
    ]
  ],
  viridis: [
    [
      0.3,
      0.45,
      0.4
    ],
    [
      0.35,
      0.35,
      0.25
    ],
    [
      1,
      1,
      1
    ],
    [
      0.6,
      0.2,
      0.1
    ]
  ]
};

function clamp01( v ) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** IQ cosine palette sampled at t∈[0,1]; `name` selects the preset. */
export function palette(
  name, t
) {
  const preset = PALETTES[ name ] ?? PALETTES.rainbow;
  const [
    a,
    b,
    c,
    d
  ] = preset;
  const TAU = Math.PI * 2;
  const r = a[ 0 ] + b[ 0 ] * Math.cos( TAU * ( c[ 0 ] * t + d[ 0 ] ) );
  const g = a[ 1 ] + b[ 1 ] * Math.cos( TAU * ( c[ 1 ] * t + d[ 1 ] ) );
  const bl = a[ 2 ] + b[ 2 ] * Math.cos( TAU * ( c[ 2 ] * t + d[ 2 ] ) );

  return [
    clamp01( r ) * 255,
    clamp01( g ) * 255,
    clamp01( bl ) * 255
  ];
}

export const PALETTE_NAMES = Object.keys( PALETTES );
