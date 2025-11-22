/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize( bytes: number | null ): string {
  if ( bytes === null ) return "";
  if ( bytes === 0 ) return "0 B";
  const k = 1024;
  const sizes = [
    "B",
    "KB",
    "MB",
    "GB"
  ];
  const i = Math.floor( Math.log( bytes ) / Math.log( k ) );

  return `${ parseFloat( ( bytes / Math.pow(
    k,
    i
  ) ).toFixed( 1 ) ) } ${ sizes[ i ] }`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration( ms: number | null ): string {
  if ( ms === null ) return "";
  const seconds = Math.floor( ms / 1000 );
  const minutes = Math.floor( seconds / 60 );
  const remainingSeconds = seconds % 60;

  if ( minutes > 0 ) {
    return `${ minutes }m ${ remainingSeconds }s`;
  }
  return `${ seconds }s`;
}
