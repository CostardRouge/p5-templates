/**
 * The sketch catalogue as an agent addresses it. A sketch's id is its route
 * tail, `<engine>/<category>/<name>` — the same string `/sketches/…` and
 * `/embed/…` carry, so an id the agent holds is also a URL a person can open.
 * A bare name is accepted when it names one sketch only (two names exist in
 * two engines).
 *
 * Pure: the entries are `src/sketches/metadata.json`, read by the caller.
 */
import {
  CommandError
} from "./registry.ts";

export interface CatalogEntry {
  name: string;
  engine: string;
  category: string | null;
  hasSketchForm?: boolean;
  hasThumbnail?: boolean;
  hasPreview?: boolean;
  hiddenFromHome?: boolean;
  hiddenFromGallery?: boolean;
}

export function sketchId( entry: CatalogEntry ): string {
  return entry.category ? `${ entry.engine }/${ entry.category }/${ entry.name }` : `${ entry.engine }/${ entry.name }`;
}

export interface CatalogFilter {
  engine?: string;
  category?: string;
  /** Case-insensitive substring of the id. */
  query?: string;
  /** Include the sketches the gallery hides (studies, tests). */
  includeHidden?: boolean;
}

export function filterCatalog(
  entries: readonly CatalogEntry[], filter: CatalogFilter
): CatalogEntry[] {
  const query = filter.query?.toLowerCase();

  return entries
    .filter( ( e ) => filter.includeHidden || !e.hiddenFromGallery )
    .filter( ( e ) => !filter.engine || e.engine === filter.engine )
    .filter( ( e ) => !filter.category || e.category === filter.category )
    .filter( ( e ) => !query || sketchId( e ).toLowerCase()
      .includes( query ) )
    .sort( (
      a, b
    ) => sketchId( a ).localeCompare( sketchId( b ) ) );
}

/** The one entry `ref` names, or `CommandError( "invalid" )` saying why not. */
export function resolveSketch(
  entries: readonly CatalogEntry[], ref: string
): CatalogEntry {
  const wanted = ref.replace(
    /^\/+|\/+$/g,
    ""
  ).replace(
    /^(sketches|embed)\//,
    ""
  );
  const exact = entries.find( ( e ) => sketchId( e ) === wanted );

  if ( exact ) {
    return exact;
  }

  const name = wanted.split( "/" ).pop() ?? wanted;
  const byName = entries.filter( ( e ) => e.name === name );

  if ( byName.length === 1 ) {
    return byName[ 0 ];
  }
  if ( byName.length > 1 ) {
    throw new CommandError(
      "invalid",
      `"${ ref }" names ${ byName.length } sketches — say which: ${ byName.map( sketchId ).join( ", " ) }`
    );
  }

  const near = entries.map( sketchId ).filter( ( id ) => id.includes( name.split( "-" )[ 0 ] ) )
    .slice(
      0,
      8
    );

  throw new CommandError(
    "invalid",
    `no sketch "${ ref }"${ near.length ? ` — near: ${ near.join( ", " ) }` : "" } (sketches.list searches the catalogue)`
  );
}
