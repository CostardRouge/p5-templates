/**
 * A kept thumbnail that holds no picture — one flat colour. Until 2026-11-19
 * every export at another size than the sketch's kept a BLACK thumbnail: the
 * run resized the canvas back and the keep read it before anything drew
 * (`overrideScope.ts`'s restore now waits and redraws). Those blank JPEGs are
 * still in people's galleries, so a view that shows a piece's thumbnail asks
 * this first and falls back to the sketch's catalogue picture.
 */

/** JPEG noise on a flat frame: channel values this close count as one colour. */
const TOLERANCE = 6;

/** True when every pixel of an RGBA buffer is the same colour, give or take {@link TOLERANCE}. Pure. */
export function isUniformPixels( data: ArrayLike<number> ): boolean {
  if ( data.length < 4 ) {
    return false;
  }

  const r = data[ 0 ];
  const g = data[ 1 ];
  const b = data[ 2 ];

  for ( let i = 4; i < data.length; i += 4 ) {
    if ( Math.abs( data[ i ] - r ) > TOLERANCE || Math.abs( data[ i + 1 ] - g ) > TOLERANCE || Math.abs( data[ i + 2 ] - b ) > TOLERANCE ) {
      return false;
    }
  }

  return true;
}

const seen = new WeakMap<Blob, Promise<boolean>>();

/**
 * Whether a thumbnail Blob is one flat colour, decoded once per Blob at 24 px
 * wide. A runtime that cannot decode answers false: show what is there.
 */
export function isBlankThumbnail( blob: Blob ): Promise<boolean> {
  const known = seen.get( blob );

  if ( known ) {
    return known;
  }

  const answer = ( async() => {
    try {
      const bitmap = await createImageBitmap( blob );
      const width = 24;
      const height = Math.max(
        1,
        Math.round( bitmap.height * width / bitmap.width )
      );
      const canvas = document.createElement( "canvas" );

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext( "2d" );

      if ( !ctx ) {
        return false;
      }

      ctx.drawImage(
        bitmap,
        0,
        0,
        width,
        height
      );
      bitmap.close();

      return isUniformPixels( ctx.getImageData(
        0,
        0,
        width,
        height
      ).data );
    } catch {
      return false;
    }
  } )();

  seen.set(
    blob,
    answer
  );

  return answer;
}
