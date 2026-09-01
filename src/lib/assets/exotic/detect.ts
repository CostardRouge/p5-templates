/**
 * Detection of "exotic" image formats the browser cannot decode natively
 * (on Chrome/Firefox): HEIF containers (`.heic`, `.heif`, `.hif`) and
 * Adobe DNG raw files (`.dng`, a TIFF container).
 *
 * Detection is based on magic bytes first — file extensions and MIME types
 * are unreliable for these formats across OSes — with the extension used
 * only to disambiguate DNG from a plain TIFF-with-wrong-name edge case.
 */

export type ExoticImageFormat = "heif" | "dng";

/** ISOBMFF brands that identify a HEIF/HEIC still-image container. */
const HEIF_BRANDS = new Set( [
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "mif1",
  "msf1"
] );

const EXOTIC_EXTENSION_RE = /\.(heic|heif|hif|dng)$/i;

function ascii(
  bytes: Uint8Array, offset: number, length: number
): string {
  let out = "";

  for ( let i = 0; i < length; i++ ) {
    out += String.fromCharCode( bytes[ offset + i ] );
  }
  return out;
}

/**
 * Sniffs a HEIF container: ISOBMFF file whose first box is `ftyp` with a
 * known HEIF major or compatible brand.
 */
export function isHeifBuffer( buffer: ArrayBuffer ): boolean {
  const bytes = new Uint8Array( buffer );

  if ( bytes.length < 16 ) {
    return false;
  }
  if ( ascii(
    bytes,
    4,
    4
  ) !== "ftyp" ) {
    return false;
  }

  const view = new DataView( buffer );
  const boxSize = view.getUint32( 0 );
  const end = Math.min(
    boxSize,
    bytes.length
  );

  if ( HEIF_BRANDS.has( ascii(
    bytes,
    8,
    4
  ) ) ) {
    return true;
  }

  // Compatible brands start after major_brand + minor_version.
  for ( let offset = 16; offset + 4 <= end; offset += 4 ) {
    if ( HEIF_BRANDS.has( ascii(
      bytes,
      offset,
      4
    ) ) ) {
      return true;
    }
  }
  return false;
}

/** Sniffs a TIFF header (both byte orders) — the container format of DNG. */
export function isTiffBuffer( buffer: ArrayBuffer ): boolean {
  const bytes = new Uint8Array( buffer );

  if ( bytes.length < 8 ) {
    return false;
  }

  const littleEndian = bytes[ 0 ] === 0x49 && bytes[ 1 ] === 0x49;
  const bigEndian = bytes[ 0 ] === 0x4d && bytes[ 1 ] === 0x4d;

  if ( !littleEndian && !bigEndian ) {
    return false;
  }

  const view = new DataView( buffer );

  return view.getUint16(
    2,
    littleEndian
  ) === 42;
}

/**
 * Classifies a file as an exotic image format, or `null` when the browser
 * can (be expected to) decode it directly. Reads only the first bytes.
 */
export async function detectExoticImage( file: File | Blob ): Promise<ExoticImageFormat | null> {
  const name = ( file as File ).name ?? "";

  // Cheap pre-filter: only sniff files whose extension or MIME hints at an
  // exotic format, so ordinary JPEG/PNG uploads never pay for a read.
  const type = file.type ?? "";
  const hinted =
    EXOTIC_EXTENSION_RE.test( name ) ||
    type.includes( "heic" ) ||
    type.includes( "heif" ) ||
    type.includes( "dng" ) ||
    type.includes( "tiff" );

  if ( !hinted ) {
    return null;
  }

  const head = await file.slice(
    0,
    64
  ).arrayBuffer();

  if ( isHeifBuffer( head ) ) {
    return "heif";
  }
  if ( isTiffBuffer( head ) ) {
    return "dng";
  }
  return null;
}
