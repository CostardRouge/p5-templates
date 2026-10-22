/**
 * Counts how many content items still reference a given image path, across
 * the root `content` list and every `slides[*].content`. Used to decide
 * whether removing the path from an `assets.images` pool would leave a
 * dangling reference.
 *
 * Field names follow the schema (`src/types/sketch.types.ts`): an `image`
 * item holds its path in `source`, an `images-stack` item in `sources`.
 *
 * Only images have content-item types today, so this helper stays
 * image-specific. Other kinds skip pool cleanup until a generic reference
 * visitor is added.
 */
export default function countImageRefs(
  values: {
    content?: unknown;
    slides?: unknown;
  } | null | undefined,
  target: string
): number {
  const lists: unknown[] = [
    values?.content
  ];

  if ( Array.isArray( values?.slides ) ) {
    for ( const slide of values.slides ) {
      lists.push( slide?.content );
    }
  }

  let n = 0;

  for ( const list of lists ) {
    if ( !Array.isArray( list ) ) {
      continue;
    }

    for ( const it of list ) {
      if ( it?.type === "image" && it?.source === target ) {
        n++;
      }

      if ( it?.type === "images-stack" && Array.isArray( it.sources ) ) {
        n += it.sources.filter( ( p: unknown ) => p === target ).length;
      }
    }
  }

  return n;
}
