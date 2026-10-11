// ─────────────────────────────────────────────────────────────────────────────
// The CSS picture of a colour ramp, for the palette picker's tiles.
//
// A ramp is drawn by the sketch from `stops` + `hardness` (the iridescent
// category bakes it in `_iridescence.js` `bakeRamp`): it LOOPS — the last stop
// blends back into the first — and each transition between neighbours is
// centred half-way through its segment, narrowed by the hardness from a full
// segment wide (0) to 4 % of it (1). This reproduces that layout with CSS
// gradient stops instead of baking pixels: a flat run of each stop, a linear
// blend across each transition, so a soft holo ramp reads soft and a riso ramp
// reads as flat bands in the tile too. Pure, so it is tested without React.
// ─────────────────────────────────────────────────────────────────────────────

export type Rgb = [ number, number, number ] | number[];

export type Paper = {
  top?: Rgb;
  bottom?: Rgb;
};

function channel(
  color: Rgb | undefined, index: number
): number {
  const value = Array.isArray( color ) ? color[ index ] : undefined;

  return Number.isFinite( value ) ? Math.round( Math.min(
    255,
    Math.max(
      0,
      value as number
    )
  ) ) : 0;
}

export function rgbCss( color: Rgb | undefined ): string {
  return `rgb(${ channel(
    color,
    0
  ) }, ${ channel(
    color,
    1
  ) }, ${ channel(
    color,
    2
  ) })`;
}

function percent( value: number ): string {
  return `${ ( Math.min(
    1,
    Math.max(
      0,
      value
    )
  ) * 100 ).toFixed( 2 ) }%`;
}

/**
 * Half-width of a transition, in segments: the bake's `gain` is
 * 1 / (1 − 0.96 · hardness) and a transition spans 1 / gain of a segment.
 */
export function transitionHalfWidth( hardness: number | undefined ): number {
  const h = Math.min(
    1,
    Math.max(
      0,
      Number.isFinite( hardness ) ? ( hardness as number ) : 0
    )
  );

  return 0.5 * ( 1 - 0.96 * h );
}

/**
 * A left-to-right `linear-gradient(…)` of the looping ramp, or `null` when
 * there is nothing to draw.
 */
export function rampGradient(
  stops: Rgb[] | undefined, hardness: number | undefined
): string | null {
  const list = Array.isArray( stops )
    ? stops.filter( ( stop ) => Array.isArray( stop ) )
    : [];
  const n = list.length;

  if ( n === 0 ) {
    return null;
  }

  if ( n === 1 ) {
    return `linear-gradient(90deg, ${ rgbCss( list[ 0 ] ) }, ${ rgbCss( list[ 0 ] ) })`;
  }

  const w = transitionHalfWidth( hardness );
  const parts = [
    `${ rgbCss( list[ 0 ] ) } 0%`
  ];

  for ( let k = 0; k < n; k++ ) {
    const from = list[ k ];
    const to = list[ ( k + 1 ) % n ];

    parts.push( `${ rgbCss( from ) } ${ percent( ( k + 0.5 - w ) / n ) }` );
    parts.push( `${ rgbCss( to ) } ${ percent( ( k + 0.5 + w ) / n ) }` );
  }

  parts.push( `${ rgbCss( list[ 0 ] ) } 100%` );

  return `linear-gradient(90deg, ${ parts.join( ", " ) })`;
}

/** The paper behind a tile: its own vertical gradient, top to bottom. */
export function paperGradient( paper: Paper | undefined ): string | null {
  if ( !paper?.top && !paper?.bottom ) {
    return null;
  }

  return `linear-gradient(180deg, ${ rgbCss( paper.top ?? paper.bottom ) }, ${ rgbCss( paper.bottom ?? paper.top ) })`;
}
