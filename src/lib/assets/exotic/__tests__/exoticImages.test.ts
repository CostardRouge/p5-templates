import ExifReader from "exifreader";

import {
  isHeifBuffer, isTiffBuffer
} from "../detect";
import {
  extractDngPreviewJpeg, isDecodableJpeg
} from "../dngPreview";
import {
  buildExifTiff,
  extractPortableExif,
  insertExifIntoJpeg
} from "../exifEmbed";

/* ------------------------------------------------------------------ */
/*  Synthetic-file helpers                                            */
/* ------------------------------------------------------------------ */

function fakeJpeg(
  size: number, sofMarker = 0xc0
): Uint8Array {
  const bytes = new Uint8Array( size ).fill( 0x11 );

  bytes[ 0 ] = 0xff;
  bytes[ 1 ] = 0xd8;
  bytes[ 2 ] = 0xff;
  bytes[ 3 ] = sofMarker;
  bytes[ 4 ] = 0x00;
  bytes[ 5 ] = 0x08;
  bytes[ size - 2 ] = 0xff;
  bytes[ size - 1 ] = 0xd9;
  return bytes;
}

function heifBuffer( majorBrand: string ): ArrayBuffer {
  const bytes = new Uint8Array( 24 );
  const view = new DataView( bytes.buffer );

  view.setUint32(
    0,
    24
  );
  const write = (
    text: string, at: number
  ) => {
    for ( let i = 0; i < 4; i++ ) {
      bytes[ at + i ] = text.charCodeAt( i );
    }
  };

  write(
    "ftyp",
    4
  );
  write(
    majorBrand,
    8
  );
  write(
    "mif1",
    16
  );
  write(
    "miaf",
    20
  );
  return bytes.buffer;
}

/**
 * Builds a minimal little-endian DNG-shaped TIFF: IFD0 advertises a small
 * JPEG via the JPEGInterchangeFormat tags and points at a SubIFD holding a
 * larger strip-based candidate whose SOF marker is configurable.
 */
function fakeDng( subIfdSofMarker: number ): {
  buffer: ArrayBuffer;
  small: Uint8Array;
  large: Uint8Array;
} {
  const small = fakeJpeg( 24 );
  const large = fakeJpeg(
    64,
    subIfdSofMarker
  );

  const smallOffset = 200;
  const largeOffset = 300;
  const subIfdOffset = 64;

  const bytes = new Uint8Array( 512 );
  const view = new DataView( bytes.buffer );

  const entry = (
    at: number,
    tag: number,
    type: number,
    value: number
  ) => {
    view.setUint16(
      at,
      tag,
      true
    );
    view.setUint16(
      at + 2,
      type,
      true
    );
    view.setUint32(
      at + 4,
      1,
      true
    );
    view.setUint32(
      at + 8,
      value,
      true
    );
  };

  // TIFF header.
  bytes[ 0 ] = 0x49;
  bytes[ 1 ] = 0x49;
  view.setUint16(
    2,
    42,
    true
  );
  view.setUint32(
    4,
    8,
    true
  );

  // IFD0: JPEGInterchangeFormat(+Length) and a SubIFDs pointer.
  view.setUint16(
    8,
    3,
    true
  );
  entry(
    10,
    0x0201,
    4,
    smallOffset
  );
  entry(
    22,
    0x0202,
    4,
    small.length
  );
  entry(
    34,
    0x014a,
    4,
    subIfdOffset
  );
  view.setUint32(
    46,
    0,
    true
  );

  // SubIFD: single JPEG-compressed strip.
  view.setUint16(
    subIfdOffset,
    3,
    true
  );
  entry(
    subIfdOffset + 2,
    0x0103,
    3,
    7
  );
  entry(
    subIfdOffset + 14,
    0x0111,
    4,
    largeOffset
  );
  entry(
    subIfdOffset + 26,
    0x0117,
    4,
    large.length
  );
  view.setUint32(
    subIfdOffset + 38,
    0,
    true
  );

  bytes.set(
    small,
    smallOffset
  );
  bytes.set(
    large,
    largeOffset
  );

  return {
    buffer: bytes.buffer,
    small,
    large
  };
}

/* ------------------------------------------------------------------ */
/*  Detection                                                         */
/* ------------------------------------------------------------------ */

describe(
  "exotic image detection",
  () => {
    it(
      "recognizes HEIF containers by major brand",
      () => {
        expect( isHeifBuffer( heifBuffer( "heic" ) ) ).toBe( true );
        expect( isHeifBuffer( heifBuffer( "msf1" ) ) ).toBe( true );
      }
    );

    it(
      "recognizes HEIF containers by compatible brand only",
      () => {
        // Major brand unknown, but `mif1` sits in the compatible list.
        expect( isHeifBuffer( heifBuffer( "xxxx" ) ) ).toBe( true );
      }
    );

    it(
      "rejects non-HEIF buffers",
      () => {
        expect( isHeifBuffer( fakeJpeg( 32 ).buffer as ArrayBuffer ) ).toBe( false );
        expect( isHeifBuffer( new ArrayBuffer( 4 ) ) ).toBe( false );
      }
    );

    it(
      "recognizes TIFF headers in both byte orders",
      () => {
        const le = new Uint8Array( [
          0x49,
          0x49,
          42,
          0,
          8,
          0,
          0,
          0
        ] );
        const be = new Uint8Array( [
          0x4d,
          0x4d,
          0,
          42,
          0,
          0,
          0,
          8
        ] );

        expect( isTiffBuffer( le.buffer as ArrayBuffer ) ).toBe( true );
        expect( isTiffBuffer( be.buffer as ArrayBuffer ) ).toBe( true );
        expect( isTiffBuffer( fakeJpeg( 16 ).buffer as ArrayBuffer ) ).toBe( false );
      }
    );
  }
);

/* ------------------------------------------------------------------ */
/*  DNG preview extraction                                            */
/* ------------------------------------------------------------------ */

describe(
  "DNG preview extraction",
  () => {
    it(
      "validates decodable JPEG streams",
      () => {
        const baseline = fakeJpeg( 32 );
        const progressive = fakeJpeg(
          32,
          0xc2
        );
        const lossless = fakeJpeg(
          32,
          0xc3
        );

        expect( isDecodableJpeg(
          baseline,
          0,
          baseline.length
        ) ).toBe( true );
        expect( isDecodableJpeg(
          progressive,
          0,
          progressive.length
        ) ).toBe( true );
        expect( isDecodableJpeg(
          lossless,
          0,
          lossless.length
        ) ).toBe( false );
      }
    );

    it(
      "extracts the largest decodable preview across IFD0 and SubIFDs",
      () => {
        const {
          buffer, large
        } = fakeDng( 0xc0 );

        expect( extractDngPreviewJpeg( buffer ) ).toEqual( large );
      }
    );

    it(
      "skips lossless-JPEG raw strips and falls back to the smaller preview",
      () => {
        const {
          buffer, small
        } = fakeDng( 0xc3 );

        expect( extractDngPreviewJpeg( buffer ) ).toEqual( small );
      }
    );

    it(
      "returns null when no decodable preview exists",
      () => {
        const bytes = new Uint8Array( 64 );
        const view = new DataView( bytes.buffer );

        bytes[ 0 ] = 0x49;
        bytes[ 1 ] = 0x49;
        view.setUint16(
          2,
          42,
          true
        );
        view.setUint32(
          4,
          8,
          true
        );
        view.setUint16(
          8,
          0,
          true
        );

        expect( extractDngPreviewJpeg( bytes.buffer as ArrayBuffer ) ).toBeNull();
      }
    );
  }
);

/* ------------------------------------------------------------------ */
/*  EXIF extraction + embedding round-trip                            */
/* ------------------------------------------------------------------ */

describe(
  "EXIF preservation",
  () => {
    it(
      "distills exifreader tags into the portable subset",
      () => {
        const portable = extractPortableExif( {
          Make: {
            description: "Sony"
          },
          Model: {
            description: "ILCE-7CM2"
          },
          ExposureTime: {
            value: [
              1,
              250
            ]
          },
          FNumber: {
            value: [
              28,
              10
            ]
          },
          ISOSpeedRatings: {
            value: 400,
            description: "400"
          },
          FocalLength: {
            value: [
              50,
              1
            ]
          },
          LensModel: {
            description: "Sony FE 50mm F1.4 GM"
          },
          GPSLatitude: {
            description: "48.8566"
          },
          GPSLatitudeRef: {
            value: [
              "N"
            ],
            description: "North latitude"
          },
          GPSLongitude: {
            description: "2.3522"
          },
          GPSLongitudeRef: {
            value: [
              "W"
            ],
            description: "West longitude"
          }
        } );

        expect( portable ).toMatchObject( {
          make: "Sony",
          model: "ILCE-7CM2",
          exposureTime: [
            1,
            250
          ],
          fNumber: [
            28,
            10
          ],
          iso: 400,
          focalLength: [
            50,
            1
          ],
          lensModel: "Sony FE 50mm F1.4 GM"
        } );
        expect( portable?.gps?.latitude ).toBeCloseTo( 48.8566 );
        expect( portable?.gps?.longitude ).toBeCloseTo( -2.3522 );
      }
    );

    it(
      "returns null when nothing usable is present",
      () => {
        expect( extractPortableExif( {} ) ).toBeNull();
      }
    );

    it(
      "round-trips tags through the embedded APP1 segment",
      () => {
        const tiff = buildExifTiff( {
          make: "Sony",
          model: "ILCE-7CM2",
          dateTimeOriginal: "2024:05:01 10:00:00",
          exposureTime: [
            1,
            250
          ],
          fNumber: [
            28,
            10
          ],
          iso: 400,
          focalLength: [
            50,
            1
          ],
          lensModel: "Sony FE 50mm F1.4 GM",
          gps: {
            latitude: 48.8566,
            longitude: -2.3522
          }
        } );
        const jpeg = insertExifIntoJpeg(
          fakeJpeg( 64 ),
          tiff
        );

        expect( jpeg.length ).toBeGreaterThan( 64 );

        const tags = ExifReader.load( jpeg.buffer as ArrayBuffer ) as Record<string, any>;

        expect( tags.Make?.description ).toBe( "Sony" );
        expect( tags.Model?.description ).toBe( "ILCE-7CM2" );
        expect( tags.DateTimeOriginal?.description ).toBe( "2024:05:01 10:00:00" );
        expect( tags.ExposureTime?.value ).toEqual( [
          1,
          250
        ] );
        expect( tags.FNumber?.value ).toEqual( [
          28,
          10
        ] );
        expect( Number( tags.ISOSpeedRatings?.description ) ).toBe( 400 );
        expect( tags.FocalLength?.value ).toEqual( [
          50,
          1
        ] );
        expect( tags.LensModel?.description ).toBe( "Sony FE 50mm F1.4 GM" );
        expect( Number( tags.GPSLatitude?.description ) ).toBeCloseTo(
          48.8566,
          3
        );
        expect( Number( tags.GPSLongitude?.description ) ).toBeCloseTo(
          2.3522,
          3
        );
        expect( tags.GPSLongitudeRef?.value?.[ 0 ] ?? tags.GPSLongitudeRef?.value ).toContain( "W" );
      }
    );

    it(
      "leaves a JPEG that already carries EXIF untouched",
      () => {
        const tiff = buildExifTiff( {
          make: "Sony"
        } );
        const once = insertExifIntoJpeg(
          fakeJpeg( 64 ),
          tiff
        );
        const twice = insertExifIntoJpeg(
          once,
          tiff
        );

        expect( twice ).toEqual( once );
      }
    );

    it(
      "refuses to build an oversized APP1 segment",
      () => {
        const jpeg = fakeJpeg( 64 );
        const huge = new Uint8Array( 0x10000 );

        expect( insertExifIntoJpeg(
          jpeg,
          huge
        ) ).toEqual( jpeg );
      }
    );
  }
);
