/**
 * A ZIP archive with its entries STORED (no compression) — the smallest writer
 * that makes a file every unzip, every OS and Claude Desktop's extension
 * installer (`.mcpb` is a plain ZIP) open. Used to package the studio relay as
 * a Claude Desktop extension (`relayBuild.ts`); a few tens of kilobytes of text
 * gain nothing worth a deflate implementation or a dependency. Ported from
 * Atelier (`src/shared/lib/zip-store.ts`).
 *
 * Names are UTF-8 (flag bit 11) and times are fixed, so the same input builds
 * the same bytes — which is what lets a test fail when the committed bundle
 * drifts from its source. Nothing past classic ZIP's limits is attempted.
 */

export interface ZipEntry {
  /** Path inside the archive, `/`-separated, no leading slash. */
  name: string;
  data: Uint8Array | string;
}

const CRC_TABLE = ( () => {
  const table = new Uint32Array( 256 );

  for ( let n = 0; n < 256; n++ ) {
    let c = n;

    for ( let k = 0; k < 8; k++ ) {
      c = c & 1 ? 0xedb88320 ^ ( c >>> 1 ) : c >>> 1;
    }
    table[ n ] = c >>> 0;
  }

  return table;
} )();

export function crc32( bytes: Uint8Array ): number {
  let c = 0xffffffff;

  for ( let i = 0; i < bytes.length; i++ ) {
    c = CRC_TABLE[ ( c ^ bytes[ i ] ) & 0xff ] ^ ( c >>> 8 );
  }

  return ( c ^ 0xffffffff ) >>> 0;
}

/** 1980-01-01 00:00 in DOS time: a fixed stamp, so a build is reproducible. */
const DOS_TIME = 0;
const DOS_DATE = ( 1 << 5 ) | 1;

export function zipStore( entries: readonly ZipEntry[] ): Uint8Array {
  if ( entries.length > 0xffff ) {
    throw new Error( "too many entries for a classic ZIP" );
  }

  const encoder = new TextEncoder();
  const files = entries.map( ( entry ) => {
    if ( !entry.name || entry.name.startsWith( "/" ) || entry.name.split( "/" ).includes( ".." ) ) {
      throw new Error( `bad entry name: ${ entry.name }` );
    }

    const data = typeof entry.data === "string" ? encoder.encode( entry.data ) : entry.data;

    return {
      name: encoder.encode( entry.name ),
      data,
      crc: crc32( data )
    };
  } );
  const localSize = files.reduce(
    (
      n, file
    ) => n + 30 + file.name.length + file.data.length,
    0
  );
  const centralSize = files.reduce(
    (
      n, file
    ) => n + 46 + file.name.length,
    0
  );

  if ( localSize + centralSize > 0xffffffff ) {
    throw new Error( "archive too large for a classic ZIP" );
  }

  const out = new Uint8Array( localSize + centralSize + 22 );
  const view = new DataView( out.buffer );
  const offsets: number[] = [];
  let at = 0;

  for ( const file of files ) {
    offsets.push( at );
    view.setUint32(
      at,
      0x04034b50,
      true
    );
    view.setUint16(
      at + 4,
      20,
      true
    ); // version needed
    view.setUint16(
      at + 6,
      0x0800,
      true
    ); // UTF-8 names
    view.setUint16(
      at + 8,
      0,
      true
    ); // stored
    view.setUint16(
      at + 10,
      DOS_TIME,
      true
    );
    view.setUint16(
      at + 12,
      DOS_DATE,
      true
    );
    view.setUint32(
      at + 14,
      file.crc,
      true
    );
    view.setUint32(
      at + 18,
      file.data.length,
      true
    );
    view.setUint32(
      at + 22,
      file.data.length,
      true
    );
    view.setUint16(
      at + 26,
      file.name.length,
      true
    );
    view.setUint16(
      at + 28,
      0,
      true
    );
    out.set(
      file.name,
      at + 30
    );
    out.set(
      file.data,
      at + 30 + file.name.length
    );
    at += 30 + file.name.length + file.data.length;
  }

  const centralAt = at;

  files.forEach( (
    file, i
  ) => {
    view.setUint32(
      at,
      0x02014b50,
      true
    );
    view.setUint16(
      at + 4,
      0x031e,
      true
    ); // made by: Unix, 3.0
    view.setUint16(
      at + 6,
      20,
      true
    );
    view.setUint16(
      at + 8,
      0x0800,
      true
    );
    view.setUint16(
      at + 10,
      0,
      true
    );
    view.setUint16(
      at + 12,
      DOS_TIME,
      true
    );
    view.setUint16(
      at + 14,
      DOS_DATE,
      true
    );
    view.setUint32(
      at + 16,
      file.crc,
      true
    );
    view.setUint32(
      at + 20,
      file.data.length,
      true
    );
    view.setUint32(
      at + 24,
      file.data.length,
      true
    );
    view.setUint16(
      at + 28,
      file.name.length,
      true
    );
    // Extra, comment, disk, internal attributes: none.
    view.setUint32(
      at + 38,
      ( 0o100644 << 16 ) >>> 0,
      true
    ); // -rw-r--r--
    view.setUint32(
      at + 42,
      offsets[ i ],
      true
    );
    out.set(
      file.name,
      at + 46
    );
    at += 46 + file.name.length;
  } );
  view.setUint32(
    at,
    0x06054b50,
    true
  );
  view.setUint16(
    at + 8,
    files.length,
    true
  );
  view.setUint16(
    at + 10,
    files.length,
    true
  );
  view.setUint32(
    at + 12,
    at - centralAt,
    true
  );
  view.setUint32(
    at + 16,
    centralAt,
    true
  );

  return out;
}
