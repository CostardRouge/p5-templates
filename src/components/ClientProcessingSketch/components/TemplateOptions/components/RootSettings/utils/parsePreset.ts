export default function parseSizePreset( value: string | number | null | undefined ): {
  w: number; h: number
} | null {
  if ( typeof value !== "string" ) return null;
  const [
    w,
    h
  ] = value.split( "x" ).map( ( n ) => parseInt(
    n,
    10
  ) );

  return Number.isFinite( w ) && Number.isFinite( h ) ? {
    w,
    h
  } : null;
}