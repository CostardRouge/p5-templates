/**
 * The 3D vector widget's five views, as plain geometry.
 *
 * Every view is built here as a display list — lines, discs, ellipses,
 * triangles, text — relative to the block's top-left corner, and nothing in
 * this file touches p5. Two renderers read the same list: the HUD widget on
 * the canvas (`widgets/vector3d.js`) and the inspector's live view tiles
 * (`ControlledVector3DViewPicker`), so a tile is the widget, not a sketch of
 * it. Colour is the renderer's business; an op only carries an alpha (0–255)
 * applied to the element's fill.
 *
 * Coordinates are shared with the `vector3d` control (vector3dMath.ts): each
 * axis' [min, max] maps to [-1, 1] ("cube space"), `yDown` mirrors y so the
 * top of the box is the canvas's top, and the box uses the control's default
 * orbit (yaw −30°, pitch π/7) plus the element's own spin.
 */

/** The views, in the order the picker shows them. `camera` = the view orbits. */
export const VECTOR3D_VIEWS = [
  {
    id: "box",
    label: "Box",
    camera: true
  },
  {
    id: "planes",
    label: "Three planes",
    camera: false
  },
  {
    id: "map-depth",
    label: "Map + depth",
    camera: false
  },
  {
    id: "bars",
    label: "Axis bars",
    camera: false
  },
  {
    id: "gizmo",
    label: "Gizmo",
    camera: true
  }
];

export const VECTOR3D_VIEW_IDS = VECTOR3D_VIEWS.map( ( view ) => view.id );

/** The view a new element starts in: a direction reads best as an arrow in a sphere. */
export function defaultVector3dView( kind ) {
  return kind === "direction" ? "gizmo" : "box";
}

export function vector3dViewLabel( id ) {
  return VECTOR3D_VIEWS.find( ( view ) => view.id === id )?.label ?? "Box";
}

/** The control's default orbit (DEFAULT_VIEW in vector3dMath.ts). */
export const DEFAULT_YAW = -Math.PI / 6;
export const DEFAULT_PITCH = Math.PI / 7;

const AXES = [
  "x",
  "y",
  "z"
];

/**
 * A triple from whatever the source holds: `{ x, y, z }` or an array of three
 * numbers. Null for anything else, so the widget draws nothing rather than a
 * wrong point.
 */
export function toTriple( value ) {
  if ( !value ) {
    return null;
  }

  if (
    typeof value === "object" &&
    !Array.isArray( value ) &&
    Number.isFinite( value.x ) &&
    Number.isFinite( value.y ) &&
    Number.isFinite( value.z )
  ) {
    return {
      x: value.x,
      y: value.y,
      z: value.z
    };
  }

  if (
    Array.isArray( value ) &&
    value.length >= 3 &&
    value.slice(
      0,
      3
    ).every( Number.isFinite )
  ) {
    return {
      x: value[ 0 ],
      y: value[ 1 ],
      z: value[ 2 ]
    };
  }

  return null;
}

function axisRange(
  domain, axis
) {
  const min = domain?.[ `${ axis }Min` ] ?? -1;
  const max = domain?.[ `${ axis }Max` ] ?? 1;

  return [
    min,
    max
  ];
}

/**
 * Each component as a 0..1 fraction of its own axis, unclamped: a value driven
 * outside its domain still reads truthfully, and only the drawing clamps.
 */
export function vector3dFractions(
  value, domain
) {
  const out = {};

  for ( const axis of AXES ) {
    const [
      min,
      max
    ] = axisRange(
      domain,
      axis
    );

    out[ axis ] = ( value[ axis ] - min ) / ( max - min || 1 );
  }

  return out;
}

/** Cube space ([-1, 1] per axis, y up on screen), as the control's toCube. */
export function vector3dCube(
  value, domain, yDown
) {
  const f = vector3dFractions(
    value,
    domain
  );
  const cube = {
    x: f.x * 2 - 1,
    y: f.y * 2 - 1,
    z: f.z * 2 - 1
  };

  if ( yDown ) {
    cube.y = -cube.y;
  }

  return cube;
}

function normalize( c ) {
  const length = Math.hypot(
    c.x,
    c.y,
    c.z
  ) || 1;

  return {
    x: c.x / length,
    y: c.y / length,
    z: c.z / length
  };
}

/** World → view rotation, Rx( pitch ) · Ry( yaw ) — viewMatrix in vector3dMath.ts. */
export function rotate(
  c, yaw, pitch = DEFAULT_PITCH
) {
  const cy = Math.cos( yaw );
  const sy = Math.sin( yaw );
  const cp = Math.cos( pitch );
  const sp = Math.sin( pitch );

  return {
    x: cy * c.x + sy * c.z,
    y: sp * sy * c.x + cp * c.y - sp * cy * c.z,
    z: -cp * sy * c.x + sp * c.y + cp * cy * c.z
  };
}

function formatNumber(
  value, decimals
) {
  if ( !Number.isFinite( value ) ) {
    return "—";
  }

  const digits = Math.max(
    0,
    Math.min(
      4,
      decimals ?? 2
    )
  );
  const text = value.toFixed( digits );

  // "-0.00" reads as a sign error; a value that rounds to zero prints as zero.
  return Number( text ) === 0 ? ( 0 ).toFixed( digits ) : text;
}

/** The printed line: the triple in its own units, or null when none is printed. */
export function vector3dCoordinatesText(
  value, cfg
) {
  if ( ( cfg?.coordinates ?? "relative" ) === "none" ) {
    return null;
  }

  return AXES.map( ( axis ) => formatNumber(
    value[ axis ],
    cfg?.decimals
  ) ).join( ", " );
}

const clamp = (
  v, a, b
) => Math.min(
  b,
  Math.max(
    a,
    v
  )
);

/** Where an axis' zero sits as a fraction, or its minimum when zero is outside. */
function zeroFraction(
  domain, axis
) {
  const [
    min,
    max
  ] = axisRange(
    domain,
    axis
  );

  return min < 0 && max > 0 ? -min / ( max - min ) : 0;
}

/**
 * A tiny display-list builder: every op is pushed relative to the block's
 * origin, so the caller only translates.
 */
function createList() {
  const ops = [];

  return {
    ops,
    line(
      x1, y1, x2, y2, a, extra
    ) {
      ops.push( {
        op: "line",
        x1,
        y1,
        x2,
        y2,
        a,
        weight: extra?.weight ?? 1,
        dash: extra?.dash ?? false
      } );
    },
    rect(
      x, y, w, h, a, fill = false
    ) {
      ops.push( {
        op: "rect",
        x,
        y,
        w,
        h,
        a,
        fill
      } );
    },
    disc(
      x, y, r, a
    ) {
      ops.push( {
        op: "disc",
        x,
        y,
        r,
        a
      } );
    },
    ring(
      x, y, r, a
    ) {
      ops.push( {
        op: "ring",
        x,
        y,
        r,
        a
      } );
    },
    ellipse(
      x, y, rx, ry, a
    ) {
      ops.push( {
        op: "ellipse",
        x,
        y,
        rx,
        ry,
        a
      } );
    },
    tri(
      points, a
    ) {
      ops.push( {
        op: "tri",
        points,
        a
      } );
    },
    text(
      text, x, y, size, a
    ) {
      ops.push( {
        op: "text",
        text,
        x,
        y,
        size,
        a
      } );
    }
  };
}

/** A fading polyline: older segments fainter, the newest at `maxAlpha`. */
function trailLines(
  list, points, weight, maxAlpha = 150
) {
  for ( let i = 1; i < points.length; i++ ) {
    list.line(
      points[ i - 1 ].x,
      points[ i - 1 ].y,
      points[ i ].x,
      points[ i ].y,
      ( i / points.length ) * maxAlpha,
      {
        weight
      }
    );
  }
}

function arrow(
  list, from, to, s, behind
) {
  const weight = Math.max(
    1,
    s * 0.08
  );

  list.line(
    from.x,
    from.y,
    to.x,
    to.y,
    230,
    {
      weight,
      dash: behind
    }
  );

  const angle = Math.atan2(
    to.y - from.y,
    to.x - from.x
  );
  const length = Math.hypot(
    to.x - from.x,
    to.y - from.y
  );

  if ( length > s * 0.6 ) {
    const head = s * 0.55;

    list.tri(
      [
        to.x,
        to.y,
        to.x - Math.cos( angle - 0.45 ) * head,
        to.y - Math.sin( angle - 0.45 ) * head,
        to.x - Math.cos( angle + 0.45 ) * head,
        to.y - Math.sin( angle + 0.45 ) * head
      ],
      230
    );
  }
}

/**
 * One square map in the 2D vector widget's vocabulary: centre cross, frame,
 * the point's guides, the point. `fa` / `fb` are fractions across / down.
 */
function squareMap(
  list, x, y, size, fa, fb, trail, s, caption
) {
  list.line(
    x,
    y + size / 2,
    x + size,
    y + size / 2,
    55
  );
  list.line(
    x + size / 2,
    y,
    x + size / 2,
    y + size,
    55
  );
  list.rect(
    x,
    y,
    size,
    size,
    110
  );

  if ( trail && trail.length > 1 ) {
    trailLines(
      list,
      trail.map( ( [
        a,
        b
      ] ) => ( {
        x: x + clamp(
          a,
          0,
          1
        ) * size,
        y: y + clamp(
          b,
          0,
          1
        ) * size
      } ) ),
      Math.max(
        1,
        s * 0.07
      )
    );
  }

  const px = x + clamp(
    fa,
    0,
    1
  ) * size;
  const py = y + clamp(
    fb,
    0,
    1
  ) * size;

  list.line(
    x,
    py,
    x + size,
    py,
    110
  );
  list.line(
    px,
    y,
    px,
    y + size,
    110
  );
  list.disc(
    px,
    py,
    s * 0.22,
    255
  );

  if ( caption ) {
    list.text(
      caption,
      x + s * 0.2,
      y + s * 0.15,
      s * 0.5,
      120
    );
  }
}

/** A gauge filled from the axis' zero (or minimum), with its trail as ticks. */
function gauge(
  list, x, y, w, h, frac, zero, vertical, s, trail
) {
  list.rect(
    x,
    y,
    w,
    h,
    110
  );

  const f = clamp(
    frac,
    0,
    1
  );
  const z0 = clamp(
    zero,
    0,
    1
  );

  if ( vertical ) {
    const a = y + ( 1 - f ) * h;
    const b = y + ( 1 - z0 ) * h;

    list.rect(
      x + 2,
      Math.min(
        a,
        b
      ),
      w - 4,
      Math.abs( b - a ),
      150,
      true
    );
    list.line(
      x - s * 0.2,
      b,
      x + w + s * 0.2,
      b,
      110
    );
    trail?.forEach( (
      t, i
    ) => {
      const ty = y + ( 1 - clamp(
        t,
        0,
        1
      ) ) * h;

      list.line(
        x + w + s * 0.15,
        ty,
        x + w + s * 0.45,
        ty,
        ( i / trail.length ) * 90
      );
    } );
    list.line(
      x - s * 0.2,
      a,
      x + w + s * 0.2,
      a,
      255
    );

    return;
  }

  const a = x + f * w;
  const b = x + z0 * w;

  list.rect(
    Math.min(
      a,
      b
    ),
    y + 2,
    Math.abs( b - a ),
    h - 4,
    150,
    true
  );
  list.line(
    b,
    y - s * 0.15,
    b,
    y + h + s * 0.15,
    110
  );
  trail?.forEach( (
    t, i
  ) => {
    const tx = x + clamp(
      t,
      0,
      1
    ) * w;

    list.line(
      tx,
      y + h + s * 0.1,
      tx,
      y + h + s * 0.35,
      ( i / trail.length ) * 90
    );
  } );
  list.line(
    a,
    y - s * 0.15,
    a,
    y + h + s * 0.15,
    255
  );
}

/** Map fractions: down = canvas down for y (with yDown), up = far for z. */
function mapFractions(
  value, domain, yDown
) {
  const f = vector3dFractions(
    value,
    domain
  );

  return {
    x: f.x,
    y: yDown ? f.y : 1 - f.y,
    z: f.z
  };
}

function cubeEdges() {
  const corners = [];

  for ( const x of [
    -1,
    1
  ] ) {
    for ( const y of [
      -1,
      1
    ] ) {
      for ( const z of [
        -1,
        1
      ] ) {
        corners.push( {
          x,
          y,
          z
        } );
      }
    }
  }

  const edges = [];

  corners.forEach( (
    a, i
  ) => corners.forEach( (
    b, j
  ) => {
    const differing = ( a.x !== b.x ) + ( a.y !== b.y ) + ( a.z !== b.z );

    if ( j > i && differing === 1 ) {
      edges.push( [
        a,
        b
      ] );
    }
  } ) );

  return edges;
}

const CUBE_EDGES = cubeEdges();

// ── The five views. Each takes the shared context and the body's origin, and
// returns the body's size; the label above and the readout below are added
// by buildVector3dView. ─────────────────────────────────────────────────────

function boxView(
  list, ctx, x, y, measureOnly
) {
  const {
    s
  } = ctx;
  const box = s * 6;

  if ( measureOnly ) {
    return {
      w: box,
      h: box
    };
  }

  const cx = x + box / 2;
  const cy = y + box / 2;
  const scale = box * 0.27;
  const project = ( c ) => {
    const q = rotate(
      c,
      ctx.yaw
    );

    return {
      x: cx + q.x * scale,
      y: cy - q.y * scale,
      z: q.z
    };
  };

  // Back edges faint, front edges at frame opacity — depth from the midpoint.
  for ( const [
    a,
    b
  ] of CUBE_EDGES ) {
    const mid = rotate(
      {
        x: ( a.x + b.x ) / 2,
        y: ( a.y + b.y ) / 2,
        z: ( a.z + b.z ) / 2
      },
      ctx.yaw
    );
    const pa = project( a );
    const pb = project( b );

    list.line(
      pa.x,
      pa.y,
      pb.x,
      pb.y,
      mid.z < -0.2 ? 45 : 110
    );
  }

  const c = ctx.cube;

  if ( ctx.trailCubes.length > 1 ) {
    trailLines(
      list,
      ctx.trailCubes.map( project ),
      Math.max(
        1,
        s * 0.07
      )
    );
  }

  const tip = project( c );

  if ( ctx.kind === "direction" ) {
    const origin = project( {
      x: 0,
      y: 0,
      z: 0
    } );

    arrow(
      list,
      origin,
      tip,
      s,
      tip.z < 0
    );
  } else {
    // The floor is the canvas's bottom face (cube y = −1 once yDown mirrored y):
    // the point's guides run across it, a stem drops to it, a shadow sits on it.
    const floor = project( {
      x: c.x,
      y: -1,
      z: c.z
    } );
    const acrossA = project( {
      x: -1,
      y: -1,
      z: c.z
    } );
    const acrossB = project( {
      x: 1,
      y: -1,
      z: c.z
    } );
    const deepA = project( {
      x: c.x,
      y: -1,
      z: -1
    } );
    const deepB = project( {
      x: c.x,
      y: -1,
      z: 1
    } );

    list.line(
      acrossA.x,
      acrossA.y,
      acrossB.x,
      acrossB.y,
      55
    );
    list.line(
      deepA.x,
      deepA.y,
      deepB.x,
      deepB.y,
      55
    );
    list.line(
      floor.x,
      floor.y,
      tip.x,
      tip.y,
      140
    );
    list.ellipse(
      floor.x,
      floor.y,
      s * 0.42,
      s * 0.16,
      70
    );
  }

  list.disc(
    tip.x,
    tip.y,
    s * 0.25 * ( 1 + tip.z * 0.18 ),
    255
  );

  for ( const [
    letter,
    end
  ] of [
      [
        "X",
        {
          x: 1.22,
          y: -1,
          z: -1
        }
      ],
      [
        "Y",
        {
          x: -1,
          y: 1.22,
          z: -1
        }
      ],
      [
        "Z",
        {
          x: -1,
          y: -1,
          z: 1.25
        }
      ]
    ] ) {
    const p = project( end );

    list.text(
      letter,
      p.x - s * 0.2,
      p.y - s * 0.35,
      s * 0.55,
      90
    );
  }

  return {
    w: box,
    h: box
  };
}

function planesView(
  list, ctx, x, y, measureOnly
) {
  const {
    s
  } = ctx;
  const map = s * 3.4;
  const gap = s * 0.45;
  const size = {
    w: map * 3 + gap * 2,
    h: map
  };

  if ( measureOnly ) {
    return size;
  }

  const f = ctx.mapFrac;
  const trail = ctx.trailMapFracs.length > 1 ? ctx.trailMapFracs : null;

  squareMap(
    list,
    x,
    y,
    map,
    f.x,
    f.y,
    trail?.map( ( q ) => [
      q.x,
      q.y
    ] ),
    s,
    "XY"
  );
  squareMap(
    list,
    x + map + gap,
    y,
    map,
    f.x,
    1 - f.z,
    trail?.map( ( q ) => [
      q.x,
      1 - q.z
    ] ),
    s,
    "XZ"
  );
  squareMap(
    list,
    x + ( map + gap ) * 2,
    y,
    map,
    f.z,
    f.y,
    trail?.map( ( q ) => [
      q.z,
      q.y
    ] ),
    s,
    "ZY"
  );

  return size;
}

function mapDepthView(
  list, ctx, x, y, measureOnly
) {
  const {
    s
  } = ctx;
  const box = s * 6;
  const barWidth = s * 0.6;
  const gap = s * 0.55;
  const size = {
    w: box + gap + barWidth + s * 0.8,
    h: box
  };

  if ( measureOnly ) {
    return size;
  }

  const f = ctx.mapFrac;
  const trail = ctx.trailMapFracs.length > 1 ? ctx.trailMapFracs : null;

  squareMap(
    list,
    x,
    y,
    box,
    f.x,
    f.y,
    trail?.map( ( q ) => [
      q.x,
      q.y
    ] ),
    s,
    null
  );
  gauge(
    list,
    x + box + gap,
    y,
    barWidth,
    box,
    f.z,
    zeroFraction(
      ctx.domain,
      "z"
    ),
    true,
    s,
    trail?.map( ( q ) => q.z )
  );
  list.text(
    "Z",
    x + box + gap + barWidth + s * 0.2,
    y,
    s * 0.55,
    120
  );

  return size;
}

function barsView(
  list, ctx, x, y, measureOnly
) {
  const {
    s
  } = ctx;
  const labelWidth = s * 0.9;
  const barWidth = s * 6;
  const barHeight = s * 0.5;
  const row = s * 1.25;
  const valueWidth = ctx.printValues ? s * 3.2 : 0;
  const size = {
    w: labelWidth + barWidth + s * 0.5 + valueWidth,
    h: row * 3
  };

  if ( measureOnly ) {
    return size;
  }

  const fractions = vector3dFractions(
    ctx.value,
    ctx.domain
  );
  const trail = ctx.trailValues.length > 1 ? ctx.trailValues : null;

  AXES.forEach( (
    axis, i
  ) => {
    const ry = y + i * row + ( row - barHeight ) / 2 - s * 0.1;

    list.text(
      axis.toUpperCase(),
      x,
      ry - s * 0.12,
      s * 0.75,
      200
    );
    gauge(
      list,
      x + labelWidth,
      ry,
      barWidth,
      barHeight,
      fractions[ axis ],
      zeroFraction(
        ctx.domain,
        axis
      ),
      false,
      s,
      trail?.map( ( t ) => vector3dFractions(
        t,
        ctx.domain
      )[ axis ] )
    );

    if ( ctx.printValues ) {
      const value = ctx.value[ axis ];

      list.text(
        `${ value >= 0 ? " " : "" }${ formatNumber(
          value,
          ctx.decimals
        ) }`,
        x + labelWidth + barWidth + s * 0.5,
        ry - s * 0.06,
        s * 0.75,
        255
      );
    }
  } );

  return size;
}

function gizmoView(
  list, ctx, x, y, measureOnly
) {
  const {
    s
  } = ctx;
  const box = s * 6;

  if ( measureOnly ) {
    return {
      w: box,
      h: box
    };
  }

  const cx = x + box / 2;
  const cy = y + box / 2;
  const radius = box * 0.42;
  const project = ( c ) => {
    const q = rotate(
      c,
      ctx.yaw
    );

    return {
      x: cx + q.x * radius,
      y: cy - q.y * radius,
      z: q.z
    };
  };

  list.ring(
    cx,
    cy,
    radius,
    110
  );

  // Equator and one meridian, front halves stronger than back halves.
  const rings = [
    ( a ) => ( {
      x: Math.cos( a ),
      y: 0,
      z: Math.sin( a )
    } ),
    ( a ) => ( {
      x: 0,
      y: Math.cos( a ),
      z: Math.sin( a )
    } )
  ];

  for ( const ring of rings ) {
    for ( let i = 0; i < 48; i++ ) {
      const a = project( ring( ( i / 48 ) * Math.PI * 2 ) );
      const b = project( ring( ( ( i + 1 ) / 48 ) * Math.PI * 2 ) );

      list.line(
        a.x,
        a.y,
        b.x,
        b.y,
        ( a.z + b.z ) / 2 < 0 ? 35 : 75
      );
    }
  }

  const origin = project( {
    x: 0,
    y: 0,
    z: 0
  } );

  for ( const [
    letter,
    axis
  ] of [
      [
        "X",
        {
          x: 1,
          y: 0,
          z: 0
        }
      ],
      [
        "Y",
        {
          x: 0,
          y: 1,
          z: 0
        }
      ],
      [
        "Z",
        {
          x: 0,
          y: 0,
          z: 1
        }
      ]
    ] ) {
    const end = project( {
      x: axis.x * 0.3,
      y: axis.y * 0.3,
      z: axis.z * 0.3
    } );
    const labelAt = project( {
      x: axis.x * 1.12,
      y: axis.y * 1.12,
      z: axis.z * 1.12
    } );

    list.line(
      origin.x,
      origin.y,
      end.x,
      end.y,
      110
    );
    list.text(
      letter,
      labelAt.x - s * 0.17,
      labelAt.y - s * 0.3,
      s * 0.55,
      90
    );
  }

  // A direction is drawn on the unit sphere; a position at its place in the
  // ball, so the arrow still says how far from the centre it is.
  const place = ( c ) => ctx.kind === "direction" ? normalize( c ) : c;

  if ( ctx.trailCubes.length > 1 ) {
    trailLines(
      list,
      ctx.trailCubes.map( ( c ) => project( place( c ) ) ),
      Math.max(
        1,
        s * 0.07
      )
    );
  }

  const tip = project( place( ctx.cube ) );

  arrow(
    list,
    origin,
    tip,
    s,
    tip.z < 0
  );
  list.disc(
    tip.x,
    tip.y,
    s * 0.2,
    255
  );

  return {
    w: box,
    h: box
  };
}

const VIEW_BUILDERS = {
  box: boxView,
  planes: planesView,
  "map-depth": mapDepthView,
  bars: barsView,
  gizmo: gizmoView
};

/** Monospace fallback: Space Mono advances 0.612 em. */
const DEFAULT_MEASURE = (
  text, size
) => String( text ).length * size * 0.612;

/**
 * Build one view as a display list.
 *
 * @param {object} args
 * @param {string} args.view         one of VECTOR3D_VIEW_IDS (unknown → box)
 * @param {{x:number,y:number,z:number}} args.value
 * @param {Array<{x:number,y:number,z:number}>} [args.trail] oldest → newest
 * @param {object} args.cfg          the element: kind, domain, yDown, coordinates, decimals
 * @param {number} args.size         the element's text size (`s`)
 * @param {number} [args.yaw]        orbit yaw for the camera views
 * @param {string} [args.label]      printed above the body; "" for none
 * @param {boolean} [args.bare]      body only: no label, no readout (the tiles)
 * @param {(text:string, size:number) => number} [args.measure]
 * @returns {{ w: number, h: number, ops: object[] }}
 */
export function buildVector3dView( {
  view,
  value,
  trail = [],
  cfg,
  size,
  yaw = DEFAULT_YAW,
  label = "",
  bare = false,
  measure = DEFAULT_MEASURE
} ) {
  const s = size;
  const domain = cfg?.domain;
  const yDown = cfg?.yDown ?? true;
  const coordinates = bare ? null : vector3dCoordinatesText(
    value,
    cfg
  );
  const build = VIEW_BUILDERS[ view ] ?? VIEW_BUILDERS.box;
  // The bars print their values on each row, so their readout line is dropped.
  const printValues = !bare && ( cfg?.coordinates ?? "relative" ) !== "none";
  const readout = view === "bars" ? null : coordinates;

  const ctx = {
    s,
    yaw,
    kind: cfg?.kind ?? "position",
    domain,
    decimals: cfg?.decimals ?? 2,
    printValues,
    value,
    cube: vector3dCube(
      value,
      domain,
      yDown
    ),
    mapFrac: mapFractions(
      value,
      domain,
      yDown
    ),
    trailValues: trail,
    trailCubes: trail.map( ( t ) => vector3dCube(
      t,
      domain,
      yDown
    ) ),
    trailMapFracs: trail.map( ( t ) => mapFractions(
      t,
      domain,
      yDown
    ) )
  };

  const list = createList();
  const text = bare ? "" : String( label ?? "" );
  const labelHeight = text ? s * 1.35 : 0;
  const body = build(
    list,
    ctx,
    0,
    labelHeight,
    false
  );
  const readoutSize = s * 0.8;
  const readoutHeight = readout === null ? 0 : readoutSize * 1.5;

  if ( text ) {
    list.text(
      text,
      0,
      0,
      s,
      255
    );
  }

  if ( readout !== null ) {
    list.text(
      readout,
      0,
      labelHeight + body.h + readoutSize * 0.4,
      readoutSize,
      255
    );
  }

  const width = Math.max(
    body.w,
    text ? measure(
      text,
      s
    ) : 0,
    readout !== null ? measure(
      readout,
      readoutSize
    ) : 0
  );

  return {
    w: width,
    h: labelHeight + body.h + readoutHeight,
    ops: list.ops
  };
}
