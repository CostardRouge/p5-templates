import {
  getP5
} from "@/p5/utils/sketch.js";

/**
 * Recursive cross / petal primitive used by every flowers-* sketch.
 *
 * Options:
 *   position        — p5.Vector — translation origin
 *   sides           — number    — petal count (PI/sides between strokes)
 *   borderColor     — p5.Color | (recursionIndex) => p5.Color
 *   borderWidth     — number
 *   backgroundColor — p5.Color (fill)
 *   size            — number    — half-length of each stroke
 *   recursive       — bool      — if true, recurses on each petal
 *   depth           — number    — recursion depth (1 = one level)
 *   angle           — number    — pre-rotation around position
 *   draw            — (i, step, options) => void — custom leaf renderer
 *   prepareRecursionOptions — (i, depth) => Partial<Options>
 */
export function cross( options ) {
  const p = getP5();

  const {
    position = p.createVector(
      0,
      0
    ),
    sides = 2,
    borderColor = p.color( 255 ),
    borderWidth = 1,
    backgroundColor = p.color( 0 ),
    size,
    recursive = false,
    depth = 3,
    angle = 0,
    draw,
    prepareRecursionOptions
  } = options;

  const maximumDepth = depth <= 0;

  p.push();
  p.translate(
    position.x,
    position.y
  );
  p.rotate( angle );

  const isBorderColorFunction = typeof borderColor === "function";

  if ( !isBorderColorFunction ) {
    p.stroke( borderColor );
  }

  p.strokeWeight( borderWidth );
  p.fill( backgroundColor );

  const step = p.PI / sides;

  for ( let i = 0; i < sides; i++ ) {
    if ( recursive && !maximumDepth ) {
      const petalAngle = ( p.TAU / sides ) * i;
      const innerSize = size / sides;

      if ( isBorderColorFunction ) {
        p.stroke( borderColor( i + 1 ) );
      }

      cross( {
        ...options,
        position: p.createVector(
          size * p.cos( petalAngle ),
          size * p.sin( petalAngle )
        ),
        size: innerSize,
        depth: depth - 1,
        ...prepareRecursionOptions?.(
          i,
          depth
        )
      } );
    } else if ( typeof draw === "function" ) {
      draw(
        i,
        step,
        options
      );
    } else {
      p.rotate( step );
      p.line(
        -size,
        0,
        size,
        0
      );
    }
  }

  p.pop();
}

/**
 * "Spiral" flower — circles arranged around a polygon's edge midpoints.
 * Used as the recursion leaf for v5-spiral.
 */
export function flower(
  size, step
) {
  const p = getP5();
  const incrementStep = p.TAU / step;

  for ( let angle = 0; angle < p.TAU; angle += incrementStep ) {
    const position = p.createVector(
      size * p.sin( angle ),
      size * p.cos( angle )
    );
    const nextPosition = p.createVector(
      size * p.sin( angle + incrementStep ),
      size * p.cos( angle + incrementStep )
    );
    const middlePosition = p.createVector(
      size * p.sin( angle + incrementStep / 2 ),
      size * p.cos( angle + incrementStep / 2 )
    );

    const innerSize = position.dist( nextPosition );

    p.circle(
      middlePosition.x,
      middlePosition.y,
      innerSize
    );
  }
}

export const PALETTES = {
  rainbow: "rainbow",
  rainbowCrazy: "rainbowCrazy",
  purple: "purple",
  purpleSimple: "purpleSimple",
  darkBlueYellow: "darkBlueYellow",
  black: "black",
  green: "green"
};
