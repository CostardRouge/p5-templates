/**
 * Pure helpers for recognising audio-asset paths.
 *
 * Kept free of any p5 / DOM / options import so both the audio engine
 * (`audio.js`) and the asset loader (`audioAssets.js`) can share them without
 * a cycle — the same split `dragMath.js` has from `draggable.js`.
 *
 * An "audio path" is what an `asset` form field of kind `audios` stores: the
 * storage key of an uploaded file (`global/audios/click.wav`) or a static
 * public path (`/assets/audio/click.wav`). It is NOT a URL to fetch — call
 * `resolveAssetURL` for that.
 */

// Container extensions a browser can decode through `decodeAudioData`. Video
// containers (`.mp4`, `.webm`) are deliberately absent: they belong to the
// videos kind, and a video path must never be mistaken for a sound.
const AUDIO_PATH_RE = /\.(mp3|wav|wave|ogg|oga|opus|weba|m4a|aac|flac|aiff?)(\?|#|$)/i;

/** True when `value` is a non-empty string naming an audio file. */
export function isAudioPath( value ) {
  return typeof value === "string" && value !== "" && AUDIO_PATH_RE.test( value );
}

/**
 * Every audio path reachable from `node`, in encounter order and de-duplicated.
 * Walks plain objects and arrays, so a whole options block can be handed over
 * (`collectAudioPaths( o.sound )`) without listing its fields.
 */
export function collectAudioPaths(
  node, acc = []
) {
  visit(
    node,
    acc,
    new Set( acc )
  );

  return acc;
}

function visit(
  node, acc, seen
) {
  if ( !node ) {
    return;
  }

  if ( typeof node === "string" ) {
    if ( isAudioPath( node ) && !seen.has( node ) ) {
      seen.add( node );
      acc.push( node );
    }

    return;
  }

  if ( Array.isArray( node ) ) {
    for ( const value of node ) {
      visit(
        value,
        acc,
        seen
      );
    }

    return;
  }

  if ( typeof node === "object" ) {
    for ( const key of Object.keys( node ) ) {
      visit(
        node[ key ],
        acc,
        seen
      );
    }
  }
}
