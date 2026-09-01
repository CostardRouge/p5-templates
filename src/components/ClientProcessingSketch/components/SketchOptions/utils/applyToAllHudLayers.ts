import type {
  FieldValues, UseFormGetValues, UseFormSetValue
} from "react-hook-form";
import deepClone from "@/utils/deepClone";

/**
 * Cross-layer HUD style propagation.
 *
 * Each standalone HUD element carries its own full style (the split of the old
 * single "hud" container removed the shared style the widgets inherited).
 * These helpers give the ergonomics back on demand: right-click a style field
 * on one HUD layer and write its value onto the same field of every other
 * HUD layer, across the root content list and every slide's.
 *
 * The change goes through `setValue`, so a single Undo reverts the whole
 * propagation via the existing form history.
 */

// The style fields every element carries plus the boxed-only background trio;
// a target that doesn't carry the field (crosshairs/bounding-box have no
// background panel) is skipped by the `undefined` read below.
const HUD_STYLE_FIELDS = new Set( [
  "fill",
  "font",
  "blend",
  "backgroundColor",
  "backgroundStroke",
  "backgroundRadius"
] );

const HUD_CONTENT_PATH = /^((?:slides\.\d+\.)?content)\.(\d+)\.([A-Za-z]+)$/;

type ParsedHudStylePath = {
  /** Content array holding the source item, e.g. `content`, `slides.1.content`. */
  base: string;
  index: number;
  field: string;
};

function isHudItem( item: unknown ): boolean {
  return typeof ( item as { type?: string } | undefined )?.type === "string" &&
    ( item as { type: string } ).type.startsWith( "hud-" );
}

/**
 * Parses a RHF path of the shape `content.<i>.<styleField>` /
 * `slides.<n>.content.<i>.<styleField>`, keeping only HUD style fields on
 * hud-* items. Returns `null` for everything else.
 */
export function parseHudStylePath(
  getValues: UseFormGetValues<FieldValues>,
  fullPath: string
): ParsedHudStylePath | null {
  const match = HUD_CONTENT_PATH.exec( fullPath );

  if ( !match || !HUD_STYLE_FIELDS.has( match[ 3 ] ) ) {
    return null;
  }

  const parsed = {
    base: match[ 1 ],
    index: Number( match[ 2 ] ),
    field: match[ 3 ]
  };

  return isHudItem( getValues( `${ parsed.base }.${ parsed.index }` ) )
    ? parsed
    : null;
}

/** Whether an "apply to all HUD layers" action is meaningful for this path. */
export function canApplyToAllHudLayers(
  getValues: UseFormGetValues<FieldValues>,
  fullPath: string
): boolean {
  return parseHudStylePath(
    getValues,
    fullPath
  ) !== null;
}

/**
 * Copies the style value at `fullPath` onto the same field of every other
 * HUD layer, in the root content list and every slide's. Layers that don't
 * carry the field are skipped. Returns the number of layers written to.
 */
export function applyToAllHudLayers(
  getValues: UseFormGetValues<FieldValues>,
  setValue: UseFormSetValue<FieldValues>,
  fullPath: string
): number {
  const parsed = parseHudStylePath(
    getValues,
    fullPath
  );

  if ( !parsed ) {
    return 0;
  }

  const value = getValues( fullPath );

  const bases: string[] = [
    "content"
  ];
  const slides = getValues( "slides" );

  if ( Array.isArray( slides ) ) {
    slides.forEach( (
      _slide, slideIndex
    ) => bases.push( `slides.${ slideIndex }.content` ) );
  }

  let applied = 0;

  for ( const base of bases ) {
    const content = getValues( base );

    if ( !Array.isArray( content ) ) {
      continue;
    }

    content.forEach( (
      item, index
    ) => {
      if (
        !isHudItem( item ) ||
        ( base === parsed.base && index === parsed.index )
      ) {
        return;
      }

      const fieldPath = `${ base }.${ index }.${ parsed.field }`;

      // A field the target type doesn't carry (background* on the overlay
      // elements) reads undefined — writing it would smuggle panel fields
      // onto items whose schema has none.
      if ( getValues( fieldPath ) === undefined ) {
        return;
      }

      setValue(
        fieldPath,
        deepClone( value ),
        {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true
        }
      );

      applied++;
    } );
  }

  return applied;
}
