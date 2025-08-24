/**
 * Converts an [r, g, b] or [r, g, b, a] array into a #RRGGBB hex string.
 * Alpha is ignored as <input type="color"> does not support it.
 */
export default function rgbaToHex( rgba: number[] ): string {
  if ( !rgba || rgba.length < 3 ) return "#000000";

  const toHex = ( c: number ) => `0${ c.toString( 16 ) }`.slice( -2 );
  const [
    r,
    g,
    b
  ] = rgba;

  return `#${ toHex( r ) }${ toHex( g ) }${ toHex( b ) }`;
}