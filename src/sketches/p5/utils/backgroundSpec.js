// ─────────────────────────────────────────────────────────────────────────────
// A sketch's background as data: a colour, or a two-colour gradient — linear
// or radial — with a strength, an easing and an optional motion over the loop.
// Import-free, so a form (`options.ts`, the studio control) and the tests read
// it as well as the painter (`background.js`).
//
// The stored value is EITHER today's colour array — every document saved
// before this control, and every sketch default — OR an object:
//
//   { kind: "solid" | "linear" | "radial",
//     from: [r, g, b, a?], to: [r, g, b, a?],
//     source: "own" | "palette",       // "palette": the paper's two colours
//     angle,                           // linear, degrees, CSS (0 = up, cw)
//     center: { x, y }, radius,        // radial, fractions of the canvas
//     strength,                        // 0 = `from` flat … 1 = reaches `to`
//     easing,                          // an easing.js name
//     motion: "none" | "rotate" | "drift" | "breathe",
//     cycles }                         // whole cycles per loop, so it closes
//
// A colour array is painted exactly as before, by the same `background()`
// call, so nothing published moves until someone opens the control.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

export const BACKGROUND_KINDS = [
  "solid",
  "linear",
  "radial"
];

export const BACKGROUND_MOTIONS = [
  "none",
  "rotate",
  "drift",
  "breathe"
];

export const BACKGROUND_DEFAULTS = {
  kind: "linear",
  source: "own",
  angle: 180,
  center: {
    x: 0.5,
    y: 0.5
  },
  radius: 1,
  strength: 1,
  easing: "linear",
  motion: "none",
  cycles: 1
};

// How far a radial centre travels when it rotates, as a fraction of the
// canvas's shorter side.
const ORBIT = 0.18;

// Samples per gradient: enough for an easing curve or a drifting fold to read
// as a curve, not a polyline.
const STOP_COUNT = 24;

export function isBackgroundObject( value ) {
  return !!value && typeof value === "object" && !Array.isArray( value );
}

function rgba( color ) {
  const c = Array.isArray( color ) ? color : [
    0,
    0,
    0
  ];

  return [
    c[ 0 ] ?? 0,
    c[ 1 ] ?? 0,
    c[ 2 ] ?? 0,
    c[ 3 ] ?? 255
  ];
}

function luminance( [
  r,
  g,
  b
] ) {
  return ( 0.2126 * r + 0.7152 * g + 0.0722 * b ) / 255;
}

/**
 * The object a colour becomes when its control switches to a gradient: the
 * colour is the first stop and the second is the same colour lifted toward
 * white (or sunk toward black on a light one), so the switch reads as a
 * gradient at once without inventing a hue.
 */
export function backgroundFromColor(
  color, kind = "linear"
) {
  const from = rgba( color );
  const target = luminance( from ) < 0.5 ? 255 : 0;
  const to = from.map( (
    channel, index
  ) => ( index === 3
    ? channel
    : Math.round( channel + ( target - channel ) * 0.3 ) ) );

  return {
    ...BACKGROUND_DEFAULTS,
    kind,
    from: Array.isArray( color ) ? [
      ...color
    ] : from,
    to
  };
}

/** A gradient object, or a colour, seen as a whole object (defaults filled). */
export function normalizeBackground( value ) {
  if ( !isBackgroundObject( value ) ) {
    return {
      ...BACKGROUND_DEFAULTS,
      kind: "solid",
      from: rgba( value ),
      to: rgba( value )
    };
  }

  return {
    ...BACKGROUND_DEFAULTS,
    ...value,
    center: {
      ...BACKGROUND_DEFAULTS.center,
      ...value.center
    }
  };
}

function triangle( x ) {
  const f = x - Math.floor( x );

  return 1 - Math.abs( 2 * f - 1 );
}

function mix(
  a, b, t
) {
  return a.map( (
    channel, index
  ) => channel + ( b[ index ] - channel ) * t );
}

/**
 * Everything a painter needs for one frame, in the canvas's own pixels.
 *
 * @param {object} value a normalized background (normalizeBackground)
 * @param {{ width: number, height: number, phase?: number,
 *   ease?: (x: number) => number, from?: number[], to?: number[] }} frame
 *   `phase` is the loop's progression (0–1); `from` / `to` override the
 *   value's colours (the palette's paper), already as 0–255 RGBA.
 * @returns {{ kind: string, stops: { offset: number, color: number[] }[],
 *   line?: number[], circle?: number[] }}
 */
export function backgroundGeometry(
  value, {
    width, height, phase = 0, ease = ( x ) => x, from, to
  }
) {
  const a = rgba( from ?? value.from );
  const b = rgba( to ?? value.to );
  const moving = value.motion !== "none" && value.cycles !== 0;
  const turn = moving ? phase * value.cycles : 0;
  let strength = Math.max(
    0,
    Math.min(
      1,
      value.strength
    )
  );

  if ( moving && value.motion === "breathe" ) {
    strength *= 0.5 + 0.5 * Math.cos( TAU * turn );
  }

  const stops = [];

  for ( let i = 0; i <= STOP_COUNT; i++ ) {
    const u = i / STOP_COUNT;
    // Drift folds the ramp and slides it, so the colours travel along the
    // axis and come back without a seam.
    const v = moving && value.motion === "drift" ? triangle( u * 0.5 + turn ) : u;

    stops.push( {
      offset: u,
      color: mix(
        a,
        b,
        ease( v ) * strength
      )
    } );
  }

  if ( value.kind === "radial" ) {
    let cx = value.center.x * width;
    let cy = value.center.y * height;

    if ( moving && value.motion === "rotate" ) {
      const orbit = ORBIT * Math.min(
        width,
        height
      );

      cx += orbit * Math.cos( TAU * turn );
      cy += orbit * Math.sin( TAU * turn );
    }

    const farthest = Math.max(
      Math.hypot(
        cx,
        cy
      ),
      Math.hypot(
        width - cx,
        cy
      ),
      Math.hypot(
        cx,
        height - cy
      ),
      Math.hypot(
        width - cx,
        height - cy
      )
    );

    return {
      kind: "radial",
      stops,
      circle: [
        cx,
        cy,
        Math.max(
          1,
          value.radius * farthest
        )
      ]
    };
  }

  // CSS's gradient line: through the centre at `angle` (0 = up, clockwise),
  // long enough that the corners sit on the first and last stop.
  const angle = ( value.angle + ( moving && value.motion === "rotate" ? 360 * turn : 0 ) ) * Math.PI / 180;
  const dx = Math.sin( angle );
  const dy = -Math.cos( angle );
  const half = ( Math.abs( width * dx ) + Math.abs( height * dy ) ) / 2;

  return {
    kind: "linear",
    stops,
    line: [
      width / 2 - dx * half,
      height / 2 - dy * half,
      width / 2 + dx * half,
      height / 2 + dy * half
    ]
  };
}
