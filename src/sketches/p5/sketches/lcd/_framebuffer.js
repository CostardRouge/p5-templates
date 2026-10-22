/**
 * A 1-bit framebuffer and the handful of raster primitives an LCD scene needs.
 *
 * Pure JavaScript over a Uint8Array — no p5, no canvas — so a scene is a pure
 * function of its inputs, unit-testable, and the same frame can be rendered
 * twice (the persistence ghost) or blended with another (the dissolve) without
 * touching the canvas. Coordinates are integer pixels; anything outside the
 * frame is silently clipped, which is what lets a scene scroll content off
 * screen without bounds checks of its own.
 */

/** Pixel operations: set ink, set paper, or flip what is there. */
export const PAPER = 0;
export const INK = 1;
export const XOR = 2;

export function createFrame(
  width, height
) {
  return {
    width,
    height,
    bits: new Uint8Array( width * height )
  };
}

export function clearFrame(
  frame, value = PAPER
) {
  frame.bits.fill( value ? 1 : 0 );
}

export function copyFrame(
  from, to
) {
  to.bits.set( from.bits );
}

export function getPixel(
  frame, x, y
) {
  x = Math.floor( x );
  y = Math.floor( y );

  if ( x < 0 || y < 0 || x >= frame.width || y >= frame.height ) {
    return 0;
  }

  return frame.bits[ y * frame.width + x ];
}

export function setPixel(
  frame, x, y, ink = INK
) {
  x = Math.floor( x );
  y = Math.floor( y );

  if ( x < 0 || y < 0 || x >= frame.width || y >= frame.height ) {
    return;
  }

  const index = y * frame.width + x;

  frame.bits[ index ] = ink === XOR
    ? 1 - frame.bits[ index ]
    : ( ink ? 1 : 0 );
}

export function hline(
  frame, x0, x1, y, ink = INK
) {
  const from = Math.min(
    x0,
    x1
  );
  const to = Math.max(
    x0,
    x1
  );

  for ( let x = from; x <= to; x++ ) {
    setPixel(
      frame,
      x,
      y,
      ink
    );
  }
}

export function vline(
  frame, x, y0, y1, ink = INK
) {
  const from = Math.min(
    y0,
    y1
  );
  const to = Math.max(
    y0,
    y1
  );

  for ( let y = from; y <= to; y++ ) {
    setPixel(
      frame,
      x,
      y,
      ink
    );
  }
}

/** Bresenham, endpoints included. */
export function line(
  frame, x0, y0, x1, y1, ink = INK
) {
  x0 = Math.round( x0 );
  y0 = Math.round( y0 );
  x1 = Math.round( x1 );
  y1 = Math.round( y1 );

  const dx = Math.abs( x1 - x0 );
  const dy = -Math.abs( y1 - y0 );
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  for ( ;; ) {
    setPixel(
      frame,
      x0,
      y0,
      ink
    );

    if ( x0 === x1 && y0 === y1 ) {
      return;
    }

    const doubled = 2 * error;

    if ( doubled >= dy ) {
      error += dy;
      x0 += sx;
    }

    if ( doubled <= dx ) {
      error += dx;
      y0 += sy;
    }
  }
}

export function fillRect(
  frame, x, y, width, height, ink = INK
) {
  for ( let row = 0; row < height; row++ ) {
    for ( let column = 0; column < width; column++ ) {
      setPixel(
        frame,
        x + column,
        y + row,
        ink
      );
    }
  }
}

export function strokeRect(
  frame, x, y, width, height, ink = INK
) {
  if ( width <= 0 || height <= 0 ) {
    return;
  }

  hline(
    frame,
    x,
    x + width - 1,
    y,
    ink
  );
  hline(
    frame,
    x,
    x + width - 1,
    y + height - 1,
    ink
  );
  vline(
    frame,
    x,
    y + 1,
    y + height - 2,
    ink
  );
  vline(
    frame,
    x + width - 1,
    y + 1,
    y + height - 2,
    ink
  );
}

// Pixel-art corner profiles: how many pixels each of the first rows of a
// rounded rectangle is inset by. Computed circles give lumpy corners at these
// sizes; these are the ones a pixel artist would draw.
const CORNER_INSETS = [
  [],
  [
    1
  ],
  [
    2,
    1
  ],
  [
    3,
    1,
    1
  ],
  [
    4,
    2,
    1,
    1
  ]
];

function cornerInset(
  radius, row, height
) {
  const profile = CORNER_INSETS[ Math.max(
    0,
    Math.min(
      CORNER_INSETS.length - 1,
      Math.round( radius )
    )
  ) ];
  const fromEdge = Math.min(
    row,
    height - 1 - row
  );

  return profile[ fromEdge ] ?? 0;
}

function insideRoundRect(
  px, py, x, y, width, height, radius
) {
  if ( px < x || py < y || px >= x + width || py >= y + height ) {
    return false;
  }

  const inset = cornerInset(
    radius,
    py - y,
    height
  );

  return px >= x + inset && px < x + width - inset;
}

export function fillRoundRect(
  frame, x, y, width, height, radius, ink = INK
) {
  for ( let row = 0; row < height; row++ ) {
    const inset = cornerInset(
      radius,
      row,
      height
    );

    hline(
      frame,
      x + inset,
      x + width - 1 - inset,
      y + row,
      ink
    );
  }
}

/** A one-pixel outline: inside the shape, but not inside it shrunk by one. */
export function strokeRoundRect(
  frame, x, y, width, height, radius, ink = INK
) {
  for ( let py = y; py < y + height; py++ ) {
    for ( let px = x; px < x + width; px++ ) {
      const inner = insideRoundRect(
        px,
        py,
        x + 1,
        y + 1,
        width - 2,
        height - 2,
        radius - 1
      );

      if ( !inner && insideRoundRect(
        px,
        py,
        x,
        y,
        width,
        height,
        radius
      ) ) {
        setPixel(
          frame,
          px,
          py,
          ink
        );
      }
    }
  }
}

/**
 * Midpoint circle outline, optionally limited to an angular range in radians
 * (screen convention: 0 is +x, angles grow clockwise because y points down).
 */
export function strokeArc(
  frame, cx, cy, radius, ink = INK, from = -Math.PI, to = Math.PI
) {
  radius = Math.round( radius );

  if ( radius <= 0 ) {
    setPixel(
      frame,
      cx,
      cy,
      ink
    );
    return;
  }

  let x = radius;
  let y = 0;
  let decision = 1 - radius;
  const plotted = new Set();
  const plot = (
    dx, dy
  ) => {
    const key = `${ dx },${ dy }`;

    if ( plotted.has( key ) ) {
      return;
    }

    plotted.add( key );

    const angle = Math.atan2(
      dy,
      dx
    );

    if ( angle >= from && angle <= to ) {
      setPixel(
        frame,
        cx + dx,
        cy + dy,
        ink
      );
    }
  };

  while ( x >= y ) {
    plot(
      x,
      y
    );
    plot(
      y,
      x
    );
    plot(
      -y,
      x
    );
    plot(
      -x,
      y
    );
    plot(
      -x,
      -y
    );
    plot(
      -y,
      -x
    );
    plot(
      y,
      -x
    );
    plot(
      x,
      -y
    );

    y++;

    if ( decision < 0 ) {
      decision += 2 * y + 1;
    } else {
      x--;
      decision += 2 * ( y - x ) + 1;
    }
  }
}

/**
 * Draws a bitmap given as rows of "#" (ink) and "." (transparent). Rows are
 * plain strings so icons stay readable — and reviewable — in source.
 */
export function drawBitmap(
  frame, rows, x, y, ink = INK
) {
  for ( let row = 0; row < rows.length; row++ ) {
    const line = rows[ row ];

    for ( let column = 0; column < line.length; column++ ) {
      if ( line[ column ] === "#" ) {
        setPixel(
          frame,
          x + column,
          y + row,
          ink
        );
      }
    }
  }
}

export function invertFrame( frame ) {
  const {
    bits
  } = frame;

  for ( let index = 0; index < bits.length; index++ ) {
    bits[ index ] = 1 - bits[ index ];
  }
}

// 8 × 8 Bayer matrix: an ordered-dither threshold per pixel. Being a fixed
// table, a dithered frame is a pure function of the grey level — no noise to
// seed, nothing that boils between two renders of the same instant.
const BAYER_8 = [
  0,
  32,
  8,
  40,
  2,
  34,
  10,
  42,
  48,
  16,
  56,
  24,
  50,
  18,
  58,
  26,
  12,
  44,
  4,
  36,
  14,
  46,
  6,
  38,
  60,
  28,
  52,
  20,
  62,
  30,
  54,
  22,
  3,
  35,
  11,
  43,
  1,
  33,
  9,
  41,
  51,
  19,
  59,
  27,
  49,
  17,
  57,
  25,
  15,
  47,
  7,
  39,
  13,
  45,
  5,
  37,
  63,
  31,
  55,
  23,
  61,
  29,
  53,
  21
];

/** The dither threshold of pixel (x, y), in (0, 1). */
export function bayerThreshold(
  x, y
) {
  return ( BAYER_8[ ( ( y & 7 ) << 3 ) | ( x & 7 ) ] + 0.5 ) / 64;
}

/**
 * Ordered dissolve from one frame to another: at `amount` 0 the result is
 * `from`, at 1 it is `to`, and in between each pixel switches once, at its own
 * Bayer threshold — the 1-bit equivalent of a cross-fade.
 */
export function dissolveFrames(
  from, to, amount, out
) {
  const {
    width, height
  } = out;

  for ( let y = 0; y < height; y++ ) {
    for ( let x = 0; x < width; x++ ) {
      const index = y * width + x;

      out.bits[ index ] = bayerThreshold(
        x,
        y
      ) < amount
        ? to.bits[ index ]
        : from.bits[ index ];
    }
  }
}

/**
 * A small integer hash to [0, 1). Scenes derive every "random" value from it
 * so a frame depends on nothing but its inputs.
 */
export function hash01( ...parts ) {
  let h = 0x811c9dc5;

  for ( const part of parts ) {
    h ^= Math.floor( part ) | 0;
    h = Math.imul(
      h,
      0x01000193
    );
    h ^= h >>> 15;
    h = Math.imul(
      h,
      0x2c1b3c6d
    );
    h ^= h >>> 12;
  }

  return ( h >>> 0 ) / 4294967296;
}
