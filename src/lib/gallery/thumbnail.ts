import {
  captureThumbnailFromCanvas
} from "@/components/ClientProcessingSketch/components/SketchOptions/utils/thumbnailUtils";
import type {
  SketchEngine
} from "@/engines/types";

/** A `data:` URL's payload as a Blob — for a 240 px JPEG, tens of kilobytes. */
export function dataUrlToBlob( dataUrl: string ): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec( dataUrl );

  if ( !match ) {
    return null;
  }

  const [
    ,
    type,
    base64,
    payload
  ] = match;

  if ( !base64 ) {
    return new Blob(
      [
        decodeURIComponent( payload )
      ],
      {
        type
      }
    );
  }

  const binary = atob( payload );
  const bytes = new Uint8Array( binary.length );

  for ( let i = 0; i < binary.length; i++ ) {
    bytes[ i ] = binary.charCodeAt( i );
  }

  return new Blob(
    [
      bytes
    ],
    {
      type
    }
  );
}

/**
 * The frame on screen as the gallery's thumbnail: the slide thumbnails' own
 * capture (240 px wide, JPEG q0.85, every engine), as a Blob. A uniform frame
 * is kept as it is — the gallery has no later retry the way the filmstrip has,
 * and a flat tile beats none. Null when there is no canvas to read.
 */
export async function captureGalleryThumbnail( engine: SketchEngine | null | undefined ): Promise<Blob | null> {
  const capture = await captureThumbnailFromCanvas( engine );

  return capture ? dataUrlToBlob( capture.dataUrl ) : null;
}
