/**
 * The variants a queued line needs but its sketch does not have yet.
 *
 * Each account is remembered to take a FORMAT (`video 9:16`, `picture 4:5` —
 * `PostizConnection.usual`), and Export › Publish routes it to the variant of
 * that format. A sketch nobody opened Export on has one variant, its own
 * size as a video: sent as it is, X, Threads and Bluesky would get the mp4
 * his rule keeps from them («sur Threads et Twitter, des images»). The queue
 * runs without him, so it adds what the usual formats ask for — the complexity
 * the plan absorbs (lab 7, Tesler) — and nothing else. Pure.
 */

import type {
  ExportSize, ExportVariant, ExportVariantPreset
} from "../export/variants";

const PRESET_OF_ASPECT: Record<string, string> = {
  "9:16": "reel",
  "4:5": "post",
  "1:1": "square",
  "16:9": "landscape"
};

export interface WantedVariant {
  /** `picture 4:5`. */
  format: string;
  /** The preset it starts from (`VARIANT_PRESETS`). */
  preset: string;
  /** What is set on it after: a still's size and name. */
  patch: Partial<Pick<ExportVariant, "size" | "name">>;
}

/**
 * For these accounts' usual formats, the variants missing among `formats`
 * (the formats the sketch's variants already give). A format Sketchbook has
 * no preset for (a carousel, an odd ratio) is left to the person.
 */
export function wantedVariants(
  usual: Readonly<Record<string, string>>,
  accountIds: readonly string[],
  formats: readonly string[],
  presets: ReadonlyArray<ExportVariantPreset>
): WantedVariant[] {
  const have = new Set( formats );
  const out: WantedVariant[] = [];

  for ( const id of accountIds ) {
    const format = usual[ id ];
    const match = format ? /^(video|picture) (\d+:\d+)$/.exec( format ) : null;
    const sized = match ? presets.find( ( p ) => p.key === PRESET_OF_ASPECT[ match[ 2 ] ] ) : undefined;

    if ( !format || !match || !sized?.size || have.has( format ) ) {
      continue;
    }
    have.add( format );
    out.push( match[ 1 ] === "video" ? {
      format,
      preset: sized.key,
      patch: {}
    } : {
      format,
      preset: "still",
      patch: {
        size: sized.size as ExportSize,
        name: `Still ${ match[ 2 ] }`
      }
    } );
  }

  return out;
}
