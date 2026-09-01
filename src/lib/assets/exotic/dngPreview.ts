/**
 * Extracts the largest browser-decodable JPEG preview embedded in a DNG.
 *
 * A DNG is a TIFF container: IFD0 usually holds a small thumbnail, and the
 * SubIFDs chain (tag 0x014A) holds the raw sensor data plus one or more
 * JPEG-compressed previews — Adobe's converter embeds up to a full-size one.
 * Walking the IFDs and pulling that preview gives display-ready pixels in
 * milliseconds, without shipping a WASM raw developer to the client.
 *
 * The one trap is that DNG raw sensor data itself is often stored with
 * Compression=7 ("new JPEG") as *lossless* JPEG (SOF3), which no browser can
 * decode — so every candidate stream is validated to contain a baseline or
 * progressive SOF marker before being considered.
 */

const TAG_COMPRESSION = 0x0103;
const TAG_STRIP_OFFSETS = 0x0111;
const TAG_STRIP_BYTE_COUNTS = 0x0117;
const TAG_SUB_IFDS = 0x014a;
const TAG_JPEG_INTERCHANGE_FORMAT = 0x0201;
const TAG_JPEG_INTERCHANGE_FORMAT_LENGTH = 0x0202;

const TYPE_SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
  13: 4
};

type IfdEntry = {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
};

type JpegCandidate = {
  offset: number;
  length: number;
};

class TiffReader {
  view: DataView;
  littleEndian: boolean;

  constructor( buffer: ArrayBuffer ) {
    this.view = new DataView( buffer );

    const b0 = this.view.getUint8( 0 );
    const b1 = this.view.getUint8( 1 );

    if ( b0 === 0x49 && b1 === 0x49 ) {
      this.littleEndian = true;
    } else if ( b0 === 0x4d && b1 === 0x4d ) {
      this.littleEndian = false;
    } else {
      throw new Error( "Not a TIFF buffer" );
    }

    if ( this.view.getUint16(
      2,
      this.littleEndian
    ) !== 42 ) {
      throw new Error( "Bad TIFF magic" );
    }
  }

  u16( offset: number ): number {
    return this.view.getUint16(
      offset,
      this.littleEndian
    );
  }

  u32( offset: number ): number {
    return this.view.getUint32(
      offset,
      this.littleEndian
    );
  }

  readEntry( offset: number ): IfdEntry {
    return {
      tag: this.u16( offset ),
      type: this.u16( offset + 2 ),
      count: this.u32( offset + 4 ),
      valueOffset: offset + 8
    };
  }

  /** Reads entry values as numbers (SHORT/LONG), inline or via offset. */
  entryValues( entry: IfdEntry ): number[] {
    const size = TYPE_SIZES[ entry.type ] ?? 1;
    const total = size * entry.count;
    const base = total <= 4 ? entry.valueOffset : this.u32( entry.valueOffset );
    const values: number[] = [];

    for ( let i = 0; i < entry.count; i++ ) {
      const at = base + i * size;

      if ( at + size > this.view.byteLength ) {
        break;
      }
      values.push( size === 2 ? this.u16( at ) : this.u32( at ) );
    }
    return values;
  }
}

/**
 * Validates that a byte range looks like a JPEG stream a browser can decode:
 * starts with SOI and declares a baseline (SOF0) or progressive (SOF2) frame
 * — lossless SOF3 (DNG raw strips) and friends are rejected.
 */
export function isDecodableJpeg(
  bytes: Uint8Array, offset: number, length: number
): boolean {
  if ( length < 4 || offset + length > bytes.length ) {
    return false;
  }
  if ( bytes[ offset ] !== 0xff || bytes[ offset + 1 ] !== 0xd8 ) {
    return false;
  }

  let at = offset + 2;
  const end = offset + length;

  while ( at + 4 <= end ) {
    if ( bytes[ at ] !== 0xff ) {
      return false;
    }

    const marker = bytes[ at + 1 ];

    if ( marker === 0xc0 || marker === 0xc1 || marker === 0xc2 ) {
      return true;
    }
    // Any other SOFn (incl. 0xc3 lossless) the browser cannot decode.
    if ( marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc ) {
      return false;
    }
    if ( marker === 0xda ) {
      // Scan data reached without a frame header — malformed.
      return false;
    }

    const segmentLength = ( bytes[ at + 2 ] << 8 ) | bytes[ at + 3 ];

    if ( segmentLength < 2 ) {
      return false;
    }
    at += 2 + segmentLength;
  }
  return false;
}

function collectCandidates(
  reader: TiffReader,
  ifdOffset: number,
  candidates: JpegCandidate[],
  visited: Set<number>
): void {
  if (
    ifdOffset <= 0 ||
    ifdOffset + 2 > reader.view.byteLength ||
    visited.has( ifdOffset )
  ) {
    return;
  }
  visited.add( ifdOffset );

  const entryCount = reader.u16( ifdOffset );
  const entries = new Map<number, IfdEntry>();

  for ( let i = 0; i < entryCount; i++ ) {
    const at = ifdOffset + 2 + i * 12;

    if ( at + 12 > reader.view.byteLength ) {
      return;
    }

    const entry = reader.readEntry( at );

    entries.set(
      entry.tag,
      entry
    );
  }

  const jif = entries.get( TAG_JPEG_INTERCHANGE_FORMAT );
  const jifLength = entries.get( TAG_JPEG_INTERCHANGE_FORMAT_LENGTH );

  if ( jif && jifLength ) {
    candidates.push( {
      offset: reader.entryValues( jif )[ 0 ],
      length: reader.entryValues( jifLength )[ 0 ]
    } );
  }

  const compression = entries.has( TAG_COMPRESSION )
    ? reader.entryValues( entries.get( TAG_COMPRESSION )! )[ 0 ]
    : undefined;

  if ( compression === 6 || compression === 7 ) {
    const offsets = entries.has( TAG_STRIP_OFFSETS )
      ? reader.entryValues( entries.get( TAG_STRIP_OFFSETS )! )
      : [];
    const counts = entries.has( TAG_STRIP_BYTE_COUNTS )
      ? reader.entryValues( entries.get( TAG_STRIP_BYTE_COUNTS )! )
      : [];

    // Only a single-strip image is a complete standalone JPEG stream.
    if ( offsets.length === 1 && counts.length === 1 ) {
      candidates.push( {
        offset: offsets[ 0 ],
        length: counts[ 0 ]
      } );
    }
  }

  const subIfds = entries.get( TAG_SUB_IFDS );

  if ( subIfds ) {
    for ( const offset of reader.entryValues( subIfds ) ) {
      collectCandidates(
        reader,
        offset,
        candidates,
        visited
      );
    }
  }

  const nextIfd = reader.u32( ifdOffset + 2 + entryCount * 12 );

  collectCandidates(
    reader,
    nextIfd,
    candidates,
    visited
  );
}

/**
 * Returns the largest decodable embedded JPEG preview from a DNG/TIFF
 * buffer, or `null` when none exists.
 */
export function extractDngPreviewJpeg( buffer: ArrayBuffer ): Uint8Array | null {
  const reader = new TiffReader( buffer );
  const bytes = new Uint8Array( buffer );
  const candidates: JpegCandidate[] = [];

  collectCandidates(
    reader,
    reader.u32( 4 ),
    candidates,
    new Set()
  );

  const valid = candidates
    .filter( ( c ) => isDecodableJpeg(
      bytes,
      c.offset,
      c.length
    ) )
    .sort( (
      a, b
    ) => b.length - a.length );

  if ( !valid.length ) {
    return null;
  }

  const best = valid[ 0 ];

  return bytes.slice(
    best.offset,
    best.offset + best.length
  );
}
