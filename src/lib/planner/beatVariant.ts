/**
 * What a campaign's beat sends, set where the Export dialog reads it: a
 * Variations post is a CAROUSEL — one still per slide — so opening it makes
 * sure the sketch's export list (`variantStore`) holds a stills-of-every-slide
 * variant and that every account of its post takes it; opening any other beat
 * of the sketch takes that choice back, since a sketch has ONE post draft and
 * its release must not inherit the carousel.
 *
 * The same two stores the dialog and `publish.compose` write, nothing else:
 * the person sees the variant in the list and can change it.
 */

import {
  addVariant, ensureVariants, getVariantSnapshot, patchVariant
} from "../export/variantStore";
import {
  VARIANT_PRESETS, type ExportVariant
} from "../export/variants";
import {
  getDraft, patchDraft
} from "../postiz/publishStore";

export const CAROUSEL_NAME = "Variations carousel";

const isCarousel = ( variant: ExportVariant ) => variant.kind === "image" && variant.slides === "all";

/**
 * Route the sketch's post for the beat being opened. `carousel` is true for a
 * Variations beat staged as slides; `channelIds` are the accounts of the kept
 * Postiz (none without one: the variant is still made, for Save).
 */
export function routeBeat(
  sketchKey: string, carousel: boolean, channelIds: readonly string[]
): string | null {
  const draft = getDraft( sketchKey );
  const carousels = new Set( ensureVariants( sketchKey ).variants.filter( isCarousel ).map( ( variant ) => variant.id ) );

  if ( !carousel ) {
    if ( !carousels.size ) {
      return null;
    }

    // The carousel was the variations': every other beat goes back to the usual routing.
    patchDraft(
      sketchKey,
      {
        variantId: draft.variantId && carousels.has( draft.variantId ) ? null : draft.variantId,
        variantFor: Object.fromEntries( Object.entries( draft.variantFor ).filter( ( [
          , id
        ] ) => !carousels.has( id ) ) )
      }
    );

    return null;
  }

  let id = [
    ...carousels
  ][ 0 ];

  if ( !id ) {
    addVariant(
      sketchKey,
      VARIANT_PRESETS.find( ( preset ) => preset.key === "still" )!
    );
    id = getVariantSnapshot( sketchKey ).variants.at( -1 )!.id;
    patchVariant(
      sketchKey,
      id,
      {
        name: CAROUSEL_NAME,
        slides: "all"
      }
    );
  }

  patchDraft(
    sketchKey,
    {
      variantId: id,
      variantFor: {
        ...draft.variantFor,
        ...Object.fromEntries( channelIds.map( ( channel ) => [
          channel,
          id
        ] ) )
      }
    }
  );

  return id;
}
