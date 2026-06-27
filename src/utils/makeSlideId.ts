/**
 * Stable, persisted id for a slide. Unlike react-hook-form's `useFieldArray`
 * field id (session-only, regenerated on reload), this id is stored in the
 * options JSON so montage slides can reference their source slides durably
 * across reorder, duplicate, reload and export.
 */
export default function makeSlideId(): string {
  if ( typeof crypto !== "undefined" && "randomUUID" in crypto ) {
    return `slide_${ crypto.randomUUID() }`;
  }

  return `slide_${ Date.now() }_${ Math.random().toString( 16 )
    .slice( 2 ) }`;
}
