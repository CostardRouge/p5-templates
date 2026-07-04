/**
 * Minimal store-only (no compression) ZIP writer for the browser.
 *
 * PNG frames are already compressed, so running them through DEFLATE would
 * burn CPU for no size win — every entry is stored (method 0). The output is
 * a standard `.zip` that Finder, Explorer and the Instagram uploader read
 * once unzipped. Deliberately dependency-free: `archiver`/`tar` are Node-only
 * and can't run client-side.
 *
 * Scope: single-disk archives with < 65 535 entries and each file/offset
 * under 4 GiB. That is far beyond a frame export, so ZIP64 is not needed.
 */

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_SIGNATURE = 0x06054b50;
// General-purpose bit 11: filenames + comments are UTF-8.
const UTF8_FLAG = 0x0800;

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if ( crcTable ) {
    return crcTable;
  }

  const table = new Uint32Array( 256 );

  for ( let n = 0; n < 256; n++ ) {
    let c = n;

    for ( let k = 0; k < 8; k++ ) {
      c = c & 1 ? 0xedb88320 ^ ( c >>> 1 ) : c >>> 1;
    }

    table[ n ] = c >>> 0;
  }

  crcTable = table;

  return table;
}

function crc32( bytes: Uint8Array ): number {
  const table = getCrcTable();
  let crc = 0xffffffff;

  for ( let i = 0; i < bytes.length; i++ ) {
    crc = ( crc >>> 8 ) ^ table[ ( crc ^ bytes[ i ] ) & 0xff ];
  }

  return ( crc ^ 0xffffffff ) >>> 0;
}

/**
 * Encode a JS `Date` into the packed DOS date/time fields ZIP uses. Seconds
 * have 2-second resolution in this format — expected, not a bug.
 */
function toDosDateTime( date: Date ): {
  time: number;
  date: number;
} {
  const time =
    ( ( date.getHours() & 0x1f ) << 11 ) |
    ( ( date.getMinutes() & 0x3f ) << 5 ) |
    ( ( date.getSeconds() >> 1 ) & 0x1f );

  const year = Math.max(
    0,
    date.getFullYear() - 1980
  );

  const dosDate =
    ( ( year & 0x7f ) << 9 ) |
    ( ( ( date.getMonth() + 1 ) & 0x0f ) << 5 ) |
    ( date.getDate() & 0x1f );

  return {
    time,
    date: dosDate
  };
}

/**
 * Assemble `entries` into a stored (uncompressed) ZIP `Blob`. `date` stamps
 * every entry's modified time; it defaults to now but is injectable so callers
 * can produce deterministic archives in tests.
 */
export function createZip(
  entries: ZipEntry[], date: Date = new Date()
): Blob {
  const encoder = new TextEncoder();
  const {
    time: dosTime, date: dosDate
  } = toDosDateTime( date );

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for ( const entry of entries ) {
    const nameBytes = encoder.encode( entry.name );
    const crc = crc32( entry.data );
    const size = entry.data.length;

    const local = new Uint8Array( 30 + nameBytes.length );
    const localView = new DataView( local.buffer );

    localView.setUint32(
      0,
      LOCAL_HEADER_SIGNATURE,
      true
    );
    localView.setUint16(
      4,
      20,
      true
    ); // version needed to extract
    localView.setUint16(
      6,
      UTF8_FLAG,
      true
    );
    localView.setUint16(
      8,
      0,
      true
    ); // method: stored
    localView.setUint16(
      10,
      dosTime,
      true
    );
    localView.setUint16(
      12,
      dosDate,
      true
    );
    localView.setUint32(
      14,
      crc,
      true
    );
    localView.setUint32(
      18,
      size,
      true
    ); // compressed size
    localView.setUint32(
      22,
      size,
      true
    ); // uncompressed size
    localView.setUint16(
      26,
      nameBytes.length,
      true
    );
    localView.setUint16(
      28,
      0,
      true
    ); // extra field length
    local.set(
      nameBytes,
      30
    );

    localParts.push(
      local,
      entry.data
    );

    const central = new Uint8Array( 46 + nameBytes.length );
    const centralView = new DataView( central.buffer );

    centralView.setUint32(
      0,
      CENTRAL_HEADER_SIGNATURE,
      true
    );
    centralView.setUint16(
      4,
      20,
      true
    ); // version made by
    centralView.setUint16(
      6,
      20,
      true
    ); // version needed to extract
    centralView.setUint16(
      8,
      UTF8_FLAG,
      true
    );
    centralView.setUint16(
      10,
      0,
      true
    ); // method: stored
    centralView.setUint16(
      12,
      dosTime,
      true
    );
    centralView.setUint16(
      14,
      dosDate,
      true
    );
    centralView.setUint32(
      16,
      crc,
      true
    );
    centralView.setUint32(
      20,
      size,
      true
    );
    centralView.setUint32(
      24,
      size,
      true
    );
    centralView.setUint16(
      28,
      nameBytes.length,
      true
    );
    centralView.setUint16(
      30,
      0,
      true
    ); // extra field length
    centralView.setUint16(
      32,
      0,
      true
    ); // comment length
    centralView.setUint16(
      34,
      0,
      true
    ); // disk number start
    centralView.setUint16(
      36,
      0,
      true
    ); // internal attributes
    centralView.setUint32(
      38,
      0,
      true
    ); // external attributes
    centralView.setUint32(
      42,
      offset,
      true
    ); // local header offset
    central.set(
      nameBytes,
      46
    );

    centralParts.push( central );

    offset += local.length + entry.data.length;
  }

  const centralSize = centralParts.reduce(
    (
      sum, part
    ) => sum + part.length,
    0
  );
  const centralOffset = offset;

  const end = new Uint8Array( 22 );
  const endView = new DataView( end.buffer );

  endView.setUint32(
    0,
    END_OF_CENTRAL_SIGNATURE,
    true
  );
  endView.setUint16(
    4,
    0,
    true
  ); // this disk number
  endView.setUint16(
    6,
    0,
    true
  ); // disk with central directory
  endView.setUint16(
    8,
    entries.length,
    true
  ); // entries on this disk
  endView.setUint16(
    10,
    entries.length,
    true
  ); // total entries
  endView.setUint32(
    12,
    centralSize,
    true
  );
  endView.setUint32(
    16,
    centralOffset,
    true
  );
  endView.setUint16(
    20,
    0,
    true
  ); // comment length

  // `Uint8Array` is generic over its backing buffer in current lib.dom types,
  // and `BlobPart` only admits `ArrayBuffer`-backed views. Every array here is
  // `ArrayBuffer`-backed at runtime, so narrow the union at this boundary.
  const blobParts = [
    ...localParts,
    ...centralParts,
    end
  ] as BlobPart[];

  return new Blob(
    blobParts,
    {
      type: "application/zip"
    }
  );
}
