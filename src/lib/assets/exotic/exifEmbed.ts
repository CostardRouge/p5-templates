/**
 * EXIF preservation for converted exotic images.
 *
 * Converting a HEIC/DNG to JPEG produces pixels without metadata, but the
 * sketch layer renders EXIF overlays (camera, lens, ISO, shutter, …) from
 * the image file itself — in the live preview *and* in headless backend
 * recordings, which only ever see the converted asset. So the interesting
 * tags are read from the original file (via exifreader, which understands
 * both HEIC and TIFF/DNG), re-serialized as a minimal TIFF block, and
 * embedded as a standard APP1 segment in the converted JPEG.
 */

export type Rational = [
  number,
  number
];

export type PortableExif = {
  make?: string;
  model?: string;
  orientation?: number;
  dateTimeOriginal?: string;
  exposureTime?: Rational;
  fNumber?: Rational;
  iso?: number;
  focalLength?: Rational;
  lensMake?: string;
  lensModel?: string;
  gps?: {
    latitude: number;
    longitude: number;
  };
};

/* ------------------------------------------------------------------ */
/*  Reading: exifreader output → portable subset                      */
/* ------------------------------------------------------------------ */

type RawTag = {
  value?: unknown;
  description?: string;
} | undefined;

export type RawExifTags = Record<string, RawTag>;

function asString( tag: RawTag ): string | undefined {
  const s = tag?.description;

  return typeof s === "string" && s.length ? s : undefined;
}

function asRational( tag: RawTag ): Rational | undefined {
  const v = tag?.value;

  if ( Array.isArray( v ) ) {
    if ( v.length === 2 && typeof v[ 0 ] === "number" && typeof v[ 1 ] === "number" ) {
      return [
        v[ 0 ],
        v[ 1 ]
      ];
    }
    const first = v[ 0 ];

    if ( Array.isArray( first ) && first.length === 2 ) {
      return [
        first[ 0 ],
        first[ 1 ]
      ];
    }
  }
  if ( typeof v === "number" && isFinite( v ) ) {
    return [
      Math.round( v * 10000 ),
      10000
    ];
  }
  return undefined;
}

function asNumber( tag: RawTag ): number | undefined {
  const v = tag?.value;

  if ( typeof v === "number" && isFinite( v ) ) {
    return v;
  }

  const n = Number( tag?.description );

  return isFinite( n ) && tag?.description !== undefined ? n : undefined;
}

function gpsSign(
  refTag: RawTag, negativeRef: string
): number {
  const raw = refTag?.value;
  const ref = Array.isArray( raw ) ? raw[ 0 ] : raw;
  const description = refTag?.description ?? "";

  if ( ref === negativeRef || description.startsWith( negativeRef === "S" ? "South" : "West" ) ) {
    return -1;
  }
  return 1;
}

/**
 * Distills an exifreader tag map down to the fields the sketch overlays
 * actually consume. Returns `null` when nothing usable was found.
 */
export function extractPortableExif( tags: RawExifTags ): PortableExif | null {
  const exif: PortableExif = {};

  exif.make = asString( tags.Make );
  exif.model = asString( tags.Model );
  exif.dateTimeOriginal = asString( tags.DateTimeOriginal );
  exif.exposureTime = asRational( tags.ExposureTime );
  exif.fNumber = asRational( tags.FNumber );
  exif.iso = asNumber( tags.ISOSpeedRatings ) ?? asNumber( tags.PhotographicSensitivity );
  exif.focalLength = asRational( tags.FocalLength );
  exif.lensMake = asString( tags.LensMake );
  exif.lensModel = asString( tags.LensModel ) ?? asString( tags.Lens );

  const orientation = asNumber( tags.Orientation );

  if ( orientation && orientation >= 1 && orientation <= 8 ) {
    exif.orientation = orientation;
  }

  const latitude = asNumber( tags.GPSLatitude );
  const longitude = asNumber( tags.GPSLongitude );

  if ( latitude !== undefined && longitude !== undefined ) {
    exif.gps = {
      latitude: latitude * gpsSign(
        tags.GPSLatitudeRef,
        "S"
      ),
      longitude: longitude * gpsSign(
        tags.GPSLongitudeRef,
        "W"
      )
    };
  }

  const hasAnything = Object.values( exif ).some( ( v ) => v !== undefined );

  return hasAnything ? exif : null;
}

/* ------------------------------------------------------------------ */
/*  Writing: portable subset → TIFF block → APP1 in JPEG              */
/* ------------------------------------------------------------------ */

const ASCII = 2;
const SHORT = 3;
const LONG = 4;
const RATIONAL = 5;

type IfdField = {
  tag: number;
  type: number;
  count: number;
  payload: Uint8Array;
};

function asciiField(
  tag: number, text: string
): IfdField {
  const bytes = new Uint8Array( text.length + 1 );

  for ( let i = 0; i < text.length; i++ ) {
    bytes[ i ] = text.charCodeAt( i ) & 0x7f;
  }
  return {
    tag,
    type: ASCII,
    count: bytes.length,
    payload: bytes
  };
}

function shortField(
  tag: number, value: number
): IfdField {
  const payload = new Uint8Array( 2 );

  new DataView( payload.buffer ).setUint16(
    0,
    value,
    true
  );
  return {
    tag,
    type: SHORT,
    count: 1,
    payload
  };
}

function longField(
  tag: number, value: number
): IfdField {
  const payload = new Uint8Array( 4 );

  new DataView( payload.buffer ).setUint32(
    0,
    value,
    true
  );
  return {
    tag,
    type: LONG,
    count: 1,
    payload
  };
}

function rationalField(
  tag: number, rationals: Rational[]
): IfdField {
  const payload = new Uint8Array( rationals.length * 8 );
  const view = new DataView( payload.buffer );

  rationals.forEach( (
    [
      numerator,
      denominator
    ], i
  ) => {
    view.setUint32(
      i * 8,
      Math.max(
        0,
        Math.round( numerator )
      ),
      true
    );
    view.setUint32(
      i * 8 + 4,
      Math.max(
        1,
        Math.round( denominator )
      ),
      true
    );
  } );
  return {
    tag,
    type: RATIONAL,
    count: rationals.length,
    payload
  };
}

function byteField(
  tag: number, bytes: number[]
): IfdField {
  return {
    tag,
    type: 1,
    count: bytes.length,
    payload: new Uint8Array( bytes )
  };
}

function ifdSize( fields: IfdField[] ): number {
  const overflow = fields.reduce(
    (
      sum, f
    ) => sum + ( f.payload.length > 4 ? alignedLength( f.payload.length ) : 0 ),
    0
  );

  return 2 + fields.length * 12 + 4 + overflow;
}

function alignedLength( length: number ): number {
  return length + ( length % 2 );
}

function writeIfd(
  out: DataView,
  bytes: Uint8Array,
  fields: IfdField[],
  ifdOffset: number
): void {
  fields.sort( (
    a, b
  ) => a.tag - b.tag );
  out.setUint16(
    ifdOffset,
    fields.length,
    true
  );

  let dataOffset = ifdOffset + 2 + fields.length * 12 + 4;

  fields.forEach( (
    field, i
  ) => {
    const at = ifdOffset + 2 + i * 12;

    out.setUint16(
      at,
      field.tag,
      true
    );
    out.setUint16(
      at + 2,
      field.type,
      true
    );
    out.setUint32(
      at + 4,
      field.count,
      true
    );

    if ( field.payload.length <= 4 ) {
      bytes.set(
        field.payload,
        at + 8
      );
    } else {
      out.setUint32(
        at + 8,
        dataOffset,
        true
      );
      bytes.set(
        field.payload,
        dataOffset
      );
      dataOffset += alignedLength( field.payload.length );
    }
  } );

  // Next-IFD pointer: none.
  out.setUint32(
    ifdOffset + 2 + fields.length * 12,
    0,
    true
  );
}

function degreesToDms( decimal: number ): Rational[] {
  const abs = Math.abs( decimal );
  const degrees = Math.floor( abs );
  const minutesFloat = ( abs - degrees ) * 60;
  const minutes = Math.floor( minutesFloat );
  const seconds = ( minutesFloat - minutes ) * 60;

  return [
    [
      degrees,
      1
    ],
    [
      minutes,
      1
    ],
    [
      Math.round( seconds * 10000 ),
      10000
    ]
  ];
}

/**
 * Serializes a PortableExif into a little-endian TIFF block (the payload of
 * a JPEG APP1 "Exif" segment, after the `Exif\0\0` signature).
 */
export function buildExifTiff( exif: PortableExif ): Uint8Array {
  const ifd0: IfdField[] = [];
  const exifIfd: IfdField[] = [];
  const gpsIfd: IfdField[] = [];

  if ( exif.make ) {
    ifd0.push( asciiField(
      0x010f,
      exif.make
    ) );
  }
  if ( exif.model ) {
    ifd0.push( asciiField(
      0x0110,
      exif.model
    ) );
  }
  if ( exif.orientation ) {
    ifd0.push( shortField(
      0x0112,
      exif.orientation
    ) );
  }

  if ( exif.exposureTime ) {
    exifIfd.push( rationalField(
      0x829a,
      [
        exif.exposureTime
      ]
    ) );
  }
  if ( exif.fNumber ) {
    exifIfd.push( rationalField(
      0x829d,
      [
        exif.fNumber
      ]
    ) );
  }
  if ( exif.iso ) {
    exifIfd.push( shortField(
      0x8827,
      Math.min(
        exif.iso,
        0xffff
      )
    ) );
  }
  if ( exif.dateTimeOriginal ) {
    exifIfd.push( asciiField(
      0x9003,
      exif.dateTimeOriginal
    ) );
  }
  if ( exif.focalLength ) {
    exifIfd.push( rationalField(
      0x920a,
      [
        exif.focalLength
      ]
    ) );
  }
  if ( exif.lensMake ) {
    exifIfd.push( asciiField(
      0xa433,
      exif.lensMake
    ) );
  }
  if ( exif.lensModel ) {
    exifIfd.push( asciiField(
      0xa434,
      exif.lensModel
    ) );
  }

  if ( exif.gps ) {
    gpsIfd.push( byteField(
      0x0000,
      [
        2,
        3,
        0,
        0
      ]
    ) );
    gpsIfd.push( asciiField(
      0x0001,
      exif.gps.latitude < 0 ? "S" : "N"
    ) );
    gpsIfd.push( rationalField(
      0x0002,
      degreesToDms( exif.gps.latitude )
    ) );
    gpsIfd.push( asciiField(
      0x0003,
      exif.gps.longitude < 0 ? "W" : "E"
    ) );
    gpsIfd.push( rationalField(
      0x0004,
      degreesToDms( exif.gps.longitude )
    ) );
  }

  if ( exifIfd.length ) {
    ifd0.push( longField(
      0x8769,
      0
    ) );
  }
  if ( gpsIfd.length ) {
    ifd0.push( longField(
      0x8825,
      0
    ) );
  }

  const ifd0Offset = 8;
  const exifIfdOffset = ifd0Offset + ifdSize( ifd0 );
  const gpsIfdOffset = exifIfdOffset + ( exifIfd.length ? ifdSize( exifIfd ) : 0 );
  const totalSize = gpsIfdOffset + ( gpsIfd.length ? ifdSize( gpsIfd ) : 0 );

  // Patch the pointer placeholders now that the layout is known.
  for ( const field of ifd0 ) {
    if ( field.tag === 0x8769 ) {
      new DataView( field.payload.buffer ).setUint32(
        0,
        exifIfdOffset,
        true
      );
    }
    if ( field.tag === 0x8825 ) {
      new DataView( field.payload.buffer ).setUint32(
        0,
        gpsIfdOffset,
        true
      );
    }
  }

  const bytes = new Uint8Array( totalSize );
  const view = new DataView( bytes.buffer );

  // TIFF header: little-endian, magic 42, IFD0 at offset 8.
  bytes[ 0 ] = 0x49;
  bytes[ 1 ] = 0x49;
  view.setUint16(
    2,
    42,
    true
  );
  view.setUint32(
    4,
    ifd0Offset,
    true
  );

  writeIfd(
    view,
    bytes,
    ifd0,
    ifd0Offset
  );
  if ( exifIfd.length ) {
    writeIfd(
      view,
      bytes,
      exifIfd,
      exifIfdOffset
    );
  }
  if ( gpsIfd.length ) {
    writeIfd(
      view,
      bytes,
      gpsIfd,
      gpsIfdOffset
    );
  }

  return bytes;
}

const EXIF_SIGNATURE = [
  0x45,
  0x78,
  0x69,
  0x66,
  0x00,
  0x00
];

/**
 * Inserts a TIFF EXIF block as an APP1 segment right after the JPEG SOI.
 * A JPEG that already carries an EXIF APP1 is returned unchanged.
 */
export function insertExifIntoJpeg(
  jpeg: Uint8Array, tiff: Uint8Array
): Uint8Array {
  if ( jpeg.length < 4 || jpeg[ 0 ] !== 0xff || jpeg[ 1 ] !== 0xd8 ) {
    return jpeg;
  }

  const segmentLength = 2 + EXIF_SIGNATURE.length + tiff.length;

  if ( segmentLength > 0xffff ) {
    return jpeg;
  }

  // Walk existing APPn segments looking for an EXIF APP1.
  let at = 2;

  while ( at + 4 <= jpeg.length && jpeg[ at ] === 0xff ) {
    const marker = jpeg[ at + 1 ];

    if ( marker < 0xe0 || marker > 0xef ) {
      break;
    }

    const length = ( jpeg[ at + 2 ] << 8 ) | jpeg[ at + 3 ];

    if ( marker === 0xe1 && EXIF_SIGNATURE.every( (
      b, i
    ) => jpeg[ at + 4 + i ] === b ) ) {
      return jpeg;
    }
    at += 2 + length;
  }

  const out = new Uint8Array( jpeg.length + 2 + segmentLength );
  const header = new Uint8Array( 4 + EXIF_SIGNATURE.length );

  header[ 0 ] = 0xff;
  header[ 1 ] = 0xe1;
  header[ 2 ] = ( segmentLength >> 8 ) & 0xff;
  header[ 3 ] = segmentLength & 0xff;
  header.set(
    EXIF_SIGNATURE,
    4
  );

  out.set( jpeg.subarray(
    0,
    2
  ) );
  out.set(
    header,
    2
  );
  out.set(
    tiff,
    2 + header.length
  );
  out.set(
    jpeg.subarray( 2 ),
    2 + header.length + tiff.length
  );

  return out;
}
