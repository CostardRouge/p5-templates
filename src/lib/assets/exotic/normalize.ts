import {
  detectExoticImage
} from "./detect";
import {
  extractDngPreviewJpeg
} from "./dngPreview";
import {
  buildExifTiff, extractPortableExif, insertExifIntoJpeg
} from "./exifEmbed";
import type {
  RawExifTags
} from "./exifEmbed";

/**
 * File extensions accepted on top of `image/*`. Browsers resolve `image/*`
 * from the OS MIME table, which usually greys out HEIC/HIF/DNG in the file
 * picker — listing the extensions explicitly makes them selectable.
 */
export const EXOTIC_IMAGE_EXTENSIONS = [
  ".heic",
  ".heif",
  ".hif",
  ".dng"
];

/** `accept` attribute value for every image file input. */
export const IMAGE_INPUT_ACCEPT = `image/*,${ EXOTIC_IMAGE_EXTENSIONS.join( "," ) }`;

const HEIF_JPEG_QUALITY = 0.92;

function canvasToJpeg( canvas: HTMLCanvasElement ): Promise<Uint8Array> {
  return new Promise( (
    resolve, reject
  ) => {
    canvas.toBlob(
      async( blob ) => {
        if ( !blob ) {
          reject( new Error( "JPEG encoding failed" ) );
          return;
        }
        resolve( new Uint8Array( await blob.arrayBuffer() ) );
      },
      "image/jpeg",
      HEIF_JPEG_QUALITY
    );
  } );
}

/**
 * Fast path: Safari decodes HEIC natively (and correctly, 10-bit HDR
 * included), so no WASM round-trip is needed there. Returns `null` when
 * the browser cannot decode the file itself.
 */
async function decodeHeifNatively( file: Blob ): Promise<Uint8Array | null> {
  if ( typeof createImageBitmap !== "function" ) {
    return null;
  }

  try {
    const bitmap = await createImageBitmap( file );
    const canvas = document.createElement( "canvas" );

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext( "2d" )!.drawImage(
      bitmap,
      0,
      0
    );
    bitmap.close();
    return await canvasToJpeg( canvas );
  } catch {
    return null;
  }
}

async function decodeHeifToJpeg( file: Blob ): Promise<Uint8Array> {
  const native = await decodeHeifNatively( file );

  if ( native ) {
    return native;
  }

  // libheif is ~1MB of WASM — loaded lazily, and only in sessions where a
  // HEIF file is actually dropped in a browser that cannot decode it.
  // libheif-js tracks a current libheif (1.19); the older heic2any wrapper
  // bundles a 2021 libheif that garbles 10-bit files (iPhone HDR .heic,
  // Sony .hif) into green-striped noise.
  const libheifModule = await import( "libheif-js/wasm-bundle" );
  const libheif = libheifModule.default ?? libheifModule;

  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode( await file.arrayBuffer() );

  if ( !images.length ) {
    throw new Error( "No image in HEIF container" );
  }

  // Multi-image HEIC (bursts, live photos): the primary image comes first.
  const image = images[ 0 ];
  const width = image.get_width();
  const height = image.get_height();

  const imageData = await new Promise<ImageData>( (
    resolve, reject
  ) => {
    image.display(
      new ImageData(
        width,
        height
      ),
      ( result ) => {
        if ( result ) {
          resolve( result as ImageData );
        } else {
          reject( new Error( "HEIF decoding failed" ) );
        }
      }
    );
  } );

  for ( const img of images ) {
    img.free();
  }

  const canvas = document.createElement( "canvas" );

  canvas.width = width;
  canvas.height = height;
  canvas.getContext( "2d" )!.putImageData(
    imageData,
    0,
    0
  );
  return canvasToJpeg( canvas );
}

async function readExifTiff( buffer: ArrayBuffer ): Promise<Uint8Array | null> {
  try {
    const {
      default: ExifReader
    } = await import( "exifreader" );

    const tags = ExifReader.load( buffer );
    const portable = extractPortableExif( tags as unknown as RawExifTags );

    if ( !portable ) {
      return null;
    }

    // The decoded pixels are already upright (libheif applies HEIF rotation
    // transforms; DNG previews are stored display-ready), so carrying the
    // original Orientation tag over would rotate them a second time.
    delete portable.orientation;

    return buildExifTiff( portable );
  } catch( error ) {
    console.warn(
      "[assets] could not read EXIF from original file",
      error
    );
    return null;
  }
}

/**
 * Converts an exotic image file (HEIC/HIF/DNG) into a plain JPEG `File`
 * that every consumer — p5's `loadImage`, thumbnails, S3, the headless
 * recording pipeline — can handle, carrying the original's EXIF along.
 *
 * Files in browser-native formats are returned untouched. Throws when a
 * detected exotic file cannot be converted.
 */
export async function normalizeImageFile( file: File ): Promise<File> {
  const format = await detectExoticImage( file );

  if ( !format ) {
    return file;
  }

  const buffer = await file.arrayBuffer();
  let jpeg: Uint8Array;

  if ( format === "heif" ) {
    jpeg = await decodeHeifToJpeg( file );
  } else {
    const preview = extractDngPreviewJpeg( buffer );

    if ( !preview ) {
      throw new Error( `No embedded JPEG preview found in ${ file.name }` );
    }
    jpeg = preview;
  }

  const exifTiff = await readExifTiff( buffer );

  if ( exifTiff ) {
    jpeg = insertExifIntoJpeg(
      jpeg,
      exifTiff
    );
  }

  // Keep the original name for provenance and append .jpg so downstream
  // extension checks (image path regexes, S3 content types) just work.
  return new File(
    [
      jpeg as BlobPart
    ],
    `${ file.name }.jpg`,
    {
      type: "image/jpeg",
      lastModified: file.lastModified
    }
  );
}
