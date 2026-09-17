/**
 * The vector map's maths, kept free of p5 so it can be tested (and read)
 * without a canvas — the widget itself only draws what these return.
 *
 * One position, three readings:
 *  - a **fraction** of the domain, which places the dot inside the box;
 *  - the **relative** pair, in the parameter's own units (what the vector2d
 *    pad shows);
 *  - the **absolute** pair, in canvas pixels (where the point actually lands).
 * `space` says which of the last two the source already carries, so the other
 * is derived rather than assumed. Switching the printed mode must never move
 * the dot: that is the invariant these functions exist to keep.
 */

/**
 * Format a number with a fixed number of decimals, without float noise.
 */
function formatNumber(
  value, decimals
) {
  if ( !Number.isFinite( value ) ) {
    return "—";
  }

  return value.toFixed( Math.max(
    0,
    Math.min(
      4,
      decimals ?? 0
    )
  ) );
}

/**
 * The point's position as a 0..1 fraction of the mapped domain, per axis.
 * Unclamped: a parameter driven outside its declared range still reads
 * truthfully here, and only the plotting clamps it into the box.
 *
 * @param { { x: number, y: number } } point
 * @param { { space?: string, min?: number, max?: number } } cfg
 * @param { { width: number, height: number } } canvas
 */
export function vectorFractions(
  point, cfg, canvas
) {
  if ( ( cfg?.space ?? "canvas" ) === "canvas" ) {
    return {
      fx: point.x / ( canvas?.width || 1 ),
      fy: point.y / ( canvas?.height || 1 )
    };
  }

  const min = cfg?.min ?? 0;
  const max = cfg?.max ?? 1;
  // A zero-width domain would divide by zero and pin the dot at NaN.
  const span = max - min || 1;

  return {
    fx: ( point.x - min ) / span,
    fy: ( point.y - min ) / span
  };
}

/**
 * The line printed under the map, or null when the element prints none.
 * "relative" reads in parameter units, "absolute" in canvas pixels — and the
 * two describe the same dot.
 */
export function vectorCoordinatesText(
  point, cfg, canvas
) {
  const coordinates = cfg?.coordinates ?? "relative";

  if ( coordinates === "none" ) {
    return null;
  }

  const canvasSpace = ( cfg?.space ?? "canvas" ) === "canvas";
  const width = canvas?.width || 1;
  const height = canvas?.height || 1;

  if ( coordinates === "absolute" ) {
    const {
      fx, fy
    } = vectorFractions(
      point,
      cfg,
      canvas
    );
    const x = canvasSpace ? point.x : fx * width;
    const y = canvasSpace ? point.y : fy * height;

    return `${ Math.round( x ) }, ${ Math.round( y ) }`;
  }

  const decimals = cfg?.decimals ?? 2;
  const x = canvasSpace ? point.x / width : point.x;
  const y = canvasSpace ? point.y / height : point.y;

  return `${ formatNumber(
    x,
    decimals
  ) }, ${ formatNumber(
    y,
    decimals
  ) }`;
}
