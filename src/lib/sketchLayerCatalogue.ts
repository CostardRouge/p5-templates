import {
  listSketchesForEngine
} from "@/engines/metadata";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

/**
 * What an embedded-sketch layer can run, and how to describe it.
 *
 * The "sketch" content item embeds another sketch as a layer. Two things are
 * needed on the client for that: the list of sketches to choose from (with
 * their thumbnails, because nobody picks a visual out of 298 names), and the
 * chosen sketch's own parameter form.
 *
 * The list is free — `@/engines/metadata` already reads `metadata.json` in the
 * browser bundle (`P5Engine` resolves sketch paths through it). The form is
 * not: `options.ts` modules are server-only, so they come over the wire from
 * `/api/sketches/form`, cached here per sketch for the life of the page.
 */

/** Only p5 sketches can be embedded — the layer renders into a p5 buffer. */
export const EMBEDDABLE_ENGINE = "p5";

export type SketchChoice = {
  /** `<category>/<name>`, or a bare `<name>` — the stored identifier. */
  path: string;
  name: string;
  category: string | null;
  thumbnail: string;
};

export type SketchForm = {
  formValues: Record<string, unknown>;
  formConfiguration: Record<string, FieldConfig>;
};

let catalogue: SketchChoice[] | null = null;

/**
 * Every sketch that can be added as a layer, in catalogue order.
 *
 * Sketches hidden from the gallery are hidden here too: the picker offers what
 * the product offers, and a sketch carrying `.hidden-template` was withdrawn on
 * purpose.
 */
export function listEmbeddableSketches(): SketchChoice[] {
  if ( catalogue ) {
    return catalogue;
  }

  catalogue = listSketchesForEngine( EMBEDDABLE_ENGINE )
    .filter( ( meta ) => !meta.hiddenFromGallery )
    .map( ( meta ) => ( {
      path: meta.category ? `${ meta.category }/${ meta.name }` : meta.name,
      name: meta.name,
      category: meta.category ?? null,
      thumbnail: getSketchThumbnailURL(
        EMBEDDABLE_ENGINE,
        meta.name
      )
    } ) );

  return catalogue;
}

export function findEmbeddableSketch( path: string | undefined ): SketchChoice | undefined {
  if ( !path ) {
    return undefined;
  }

  return listEmbeddableSketches().find( ( choice ) => choice.path === path );
}

/** Last path segment — the sketch's own name, which is how the API keys it. */
export function sketchNameFromPath( path: string ): string {
  const segments = path.split( "/" );

  return segments[ segments.length - 1 ] ?? path;
}

const formCache = new Map<string, Promise<SketchForm>>();

/**
 * The embedded sketch's parameter form. Cached (and de-duplicated) per sketch:
 * two layers running the same sketch, or reopening one inspector, must not
 * refetch. A failed fetch is dropped from the cache so it can be retried.
 */
export function loadSketchForm( path: string ): Promise<SketchForm> {
  const cached = formCache.get( path );

  if ( cached ) {
    return cached;
  }

  const pending = fetch( `/api/sketches/form?engine=${ EMBEDDABLE_ENGINE }&sketch=${
    encodeURIComponent( sketchNameFromPath( path ) )
  }` )
    .then( async( response ) => {
      if ( !response.ok ) {
        throw new Error( `Failed to load the form for "${ path }" (${ response.status })` );
      }

      const body = await response.json();

      return {
        formValues: ( body.formValues ?? {} ) as Record<string, unknown>,
        formConfiguration: ( body.formConfiguration ?? {} ) as Record<string, FieldConfig>
      };
    } )
    .catch( ( error ) => {
      formCache.delete( path );
      throw error;
    } );

  formCache.set(
    path,
    pending
  );

  return pending;
}
