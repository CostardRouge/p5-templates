export default function parseSizePreset( value: string | number | null | undefined ): {
  width: number; height: number
} | null {
  if ( typeof value !== "string" ) return null;
  const [
    width,
    height
  ] = value
    .split( "x" )
    .map( ( number ) => parseInt(
      number,
      10
    ) );

  return Number.isFinite( width ) && Number.isFinite( height ) ? {
    width,
    height
  } : null;
}