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

async function decodeHeifToJpeg( file: Blob ): Promise<Uint8Array> {
  // libheif (via heic2any) is ~1MB of WASM — loaded lazily, and only in
  // sessions where a HEIF file is actually dropped.
  const {
    default: heic2any
  } = await import( "heic2any" );

  const result = await heic2any( {
    blob: file,
    toType: "image/jpeg",
    quality: HEIF_JPEG_QUALITY
  } );
  // Multi-image HEIC (bursts, live photos) yields an array — take the
  // primary image.
  const blob = Array.isArray( result ) ? result[ 0 ] : result;

  return new Uint8Array( await blob.arrayBuffer() );
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
