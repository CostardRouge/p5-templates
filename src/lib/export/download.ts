/**
 * Hand a blob to the browser as a download.
 *
 * One implementation for every export path — the recorder, the frame
 * sequence and the still snapshot each used to carry their own copy of this
 * six-line dance, and they drifted (only two of the three put the export
 * dimensions in the filename).
 */
export function triggerDownload(
  blob: Blob, filename: string
): void {
  const url = URL.createObjectURL( blob );
  const anchor = document.createElement( "a" );

  anchor.style.display = "none";
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild( anchor );
  anchor.click();

  setTimeout(
    () => {
      anchor.remove();
      URL.revokeObjectURL( url );
    },
    100
  );
}

/** Human-readable byte count for the variant list's "done" state. */
export function formatBytes( bytes: number ): string {
  if ( bytes < 1024 ) {
    return `${ bytes } B`;
  }

  const units = [
    "KB",
    "MB",
    "GB"
  ];
  let value = bytes / 1024;
  let unit = 0;

  while ( value >= 1024 && unit < units.length - 1 ) {
    value /= 1024;
    unit++;
  }

  return `${ value.toFixed( value < 10 ? 1 : 0 ) } ${ units[ unit ] }`;
}
