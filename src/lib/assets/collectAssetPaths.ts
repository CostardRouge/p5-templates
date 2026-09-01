/**
 * Pure helpers for recognising image-asset paths inside a sketch's options.
 *
 * Kept free of any p5 / DOM / options import so the p5 asset loader
 * (`src/sketches/p5/utils/options.js`) and the engine's loading planner
 * (`src/engines/p5/P5Engine.ts`) can share them — the same split
 * `audioPaths.js` has from `audio.js`, but living here rather than under the
 * p5 utils because the engine layer consumes it too and it describes the
 * options schema, not the p5 runtime.
 *
 * Sharing matters beyond tidiness: the planner declares how many images it
 * expects and the loader opens the steps, so if the two disagreed about what
 * counts as an image the reported progress would never reach its own total.
 *
 * An "image path" is what an `asset` form field of kind `images` stores: the
 * storage key of an uploaded file (`global/images/dune.jpg`), a static public
 * path (`/assets/images/dune.jpg`), or a `blob:` URL for a file the user has
 * just dropped in. It is NOT a URL to fetch — call `resolveAssetURL` for that.
 */

const IMAGE_PATH_RE = /\.(png|jpe?g|webp|gif|svg|avif|bmp|arw)(\?|#|$)/i;

/** True when `value` is a non-empty string naming an image. */
export function isImagePath( value: unknown ): boolean {
  if ( typeof value !== "string" || !value ) {
    return false;
  }

  // A freshly dropped file has no extension to test — the blob URL is the path.
  if ( value.startsWith( "blob:" ) ) {
    return true;
  }

  return IMAGE_PATH_RE.test( value );
}

/**
 * Every image path reachable from `node`, in encounter order and de-duplicated.
 * Walks plain objects and arrays, so a whole options block can be handed over
 * without listing its fields — which is how single `image` components nested
 * anywhere under `sketch.*` (say `sketch.photo.image`) get picked up.
 */
export function collectImagePathsDeep(
  node: unknown,
  acc: string[] = []
): string[] {
  visit(
    node,
    acc,
    new Set( acc )
  );

  return acc;
}

function visit(
  node: unknown,
  acc: string[],
  seen: Set<string>
): void {
  if ( !node ) {
    return;
  }

  if ( typeof node === "string" ) {
    if ( isImagePath( node ) && !seen.has( node ) ) {
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
    for ( const value of Object.values( node as Record<string, unknown> ) ) {
      visit(
        value,
        acc,
        seen
      );
    }
  }
}

type OptionsLike = {
  assets?: { images?: string[] };
  sketch?: unknown;
  slides?: Array<{ assets?: { images?: string[] };
    sketch?: unknown } | null | undefined>;
} | null | undefined;

/**
 * Every image the given options ask for: the global `assets.images` list, any
 * image stored directly in a sketch form field, and the same two per slide —
 * de-duplicated, in encounter order.
 */
export function collectSketchImagePaths( options: OptionsLike ): string[] {
  const acc: string[] = [];
  const seen = new Set<string>();

  const push = ( value: unknown ) => visit(
    value,
    acc,
    seen
  );

  push( options?.assets?.images );
  push( options?.sketch );

  for ( const slide of options?.slides ?? [] ) {
    push( slide?.assets?.images );
    push( slide?.sketch );
  }

  return acc;
}
