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

type ContentLike = Array<{ type?: string;
  settings?: unknown } | null | undefined>;

type OptionsLike = {
  assets?: { images?: string[] };
  sketch?: unknown;
  content?: ContentLike;
  slides?: Array<{ assets?: { images?: string[] };
    sketch?: unknown;
    content?: ContentLike } | null | undefined>;
} | null | undefined;

/**
 * An embedded-sketch layer (`sketch` content item) carries a WHOLE sketch's
 * parameters under `settings`, so a photo sketch dropped in as a layer keeps
 * its image paths there — exactly like the page's own `sketch` block. Without
 * this it would render with no photos at all.
 *
 * Only that one item type is walked. Every other content item resolves its
 * images out of the asset list, which is collected already, and widening this
 * to the whole content array would inflate the loading planner's total with
 * paths no step ever opens.
 */
function pushEmbeddedSketchImages(
  content: ContentLike | undefined,
  push: ( value: unknown ) => void
): void {
  for ( const item of content ?? [] ) {
    if ( item?.type === "sketch" ) {
      push( item.settings );
    }
  }
}

/**
 * Every image the given options ask for: the global `assets.images` list, any
 * image stored directly in a sketch form field, any carried by an
 * embedded-sketch layer's own settings, and the same three per slide —
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
  pushEmbeddedSketchImages(
    options?.content,
    push
  );

  for ( const slide of options?.slides ?? [] ) {
    push( slide?.assets?.images );
    push( slide?.sketch );
    pushEmbeddedSketchImages(
      slide?.content,
      push
    );
  }

  return acc;
}
