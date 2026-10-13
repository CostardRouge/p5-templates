import easing from "@/p5/utils/easing.js";
import {
  backgroundGeometry,
  isBackgroundObject,
  normalizeBackground
} from "@/p5/utils/backgroundSpec.js";

type Rgba = number[];

function css( [
  r,
  g,
  b,
  a = 255
]:
Rgba ): string {
  return `rgba(${ Math.round( r ) },${ Math.round( g ) },${ Math.round( b ) },${ ( a / 255 ).toFixed( 3 ) })`;
}

/**
 * The bar's swatch: the background at rest (phase 0), as CSS — the same stops
 * the painter lays (strength and easing included), on a linear strip at the
 * value's own angle or a radial blot around its centre.
 */
export function backgroundSwatch(
  value: unknown,
  paper?: { top: Rgba;
    bottom?: Rgba } | null
): string {
  if ( !isBackgroundObject( value ) ) {
    return Array.isArray( value ) ? css( value as Rgba ) : "transparent";
  }

  const spec = normalizeBackground( value );
  const from = paper ? [
    ...paper.top.slice(
      0,
      3
    ),
    spec.from[ 3 ] ?? 255
  ] : spec.from;
  const to = paper ? [
    ...( paper.bottom ?? paper.top ).slice(
      0,
      3
    ),
    spec.to[ 3 ] ?? 255
  ] : spec.to;

  if ( spec.kind === "solid" ) {
    return css( from );
  }

  const geometry = backgroundGeometry(
    spec,
    {
      width: 100,
      height: 100,
      ease: ( easing as Record<string, ( x: number ) => number> )[ spec.easing ] ?? easing.linear,
      from,
      to
    }
  );
  const stops = geometry.stops.map( ( stop ) => `${ css( stop.color ) } ${ ( stop.offset * 100 ).toFixed( 1 ) }%` );

  if ( geometry.kind === "radial" && geometry.circle ) {
    const [
      cx,
      cy,
      radius
    ] = geometry.circle;

    return `radial-gradient(circle ${ radius.toFixed( 1 ) }% at ${ cx.toFixed( 1 ) }% ${ cy.toFixed( 1 ) }%, ${ stops.join( ", " ) })`;
  }

  return `linear-gradient(${ spec.angle }deg, ${ stops.join( ", " ) })`;
}
