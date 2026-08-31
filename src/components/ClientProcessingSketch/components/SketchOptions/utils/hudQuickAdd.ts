import type {
  FieldValues, UseFormGetValues, UseFormSetValue
} from "react-hook-form";

import {
  getSketchScope, toSketchRelativePath
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/BindingAffordance/bindingUtils";
import makeDefaultItem from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/utils/makeDefaultItem";
import type {
  ItemKind
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  CONTENT_ITEM_SELECT_EVENT
} from "@/components/ClientProcessingSketch/components/SketchOptions/constants/drawer-events";

/**
 * HUD quick-add: right-click a sketch control → add a HUD element already
 * bound to that control's key-path, skipping the palette + source-picker
 * round trip.
 *
 * Only sketch parameters qualify (`getSketchScope` — content-item forms,
 * canvas/animation and the interactive namespace are excluded), and the
 * offered kinds follow the control's component:
 *  - slider / number → counter, gauge, sparkline (the numeric readouts)
 *  - color           → swatch
 * `vector2d` is deliberately NOT offered: crosshairs consumes canvas-pixel
 * points while sketch vector params are normalized 0..1, so the reticle would
 * pin near the top-left corner instead of tracking the value.
 */

const NUMERIC_COMPONENTS = new Set( [
  "slider",
  "number"
] );

export function hudQuickAddKinds(
  registeredName: string,
  config: FieldConfig
): ItemKind[] {
  if ( getSketchScope( registeredName ) === null ) {
    return [];
  }

  if ( NUMERIC_COMPONENTS.has( config.component ) ) {
    return [
      "hud-counter",
      "hud-gauge",
      "hud-sparkline"
    ];
  }

  if ( config.component === "color" ) {
    return [
      "hud-swatch"
    ];
  }

  return [];
}

/**
 * Add a HUD element of the given kind bound to the control at
 * `registeredName`, into the control's own scope (root `content` for
 * `sketch.…`, the slide's list for `slides.N.sketch.…`), then reveal the new
 * layer's inspector through the same window event an on-canvas press uses —
 * so the pre-filled source is immediately visible. Returns the new item's
 * form path, or null when the field doesn't qualify.
 */
export function addHudElementForControl(
  getValues: UseFormGetValues<FieldValues>,
  setValue: UseFormSetValue<FieldValues>,
  registeredName: string,
  config: FieldConfig,
  kind: ItemKind
): string | null {
  const scope = getSketchScope( registeredName );
  const source = toSketchRelativePath( registeredName );

  if ( !scope || !source ) {
    return null;
  }

  const slideMatch = /^slides\.(\d+)\.sketch$/.exec( scope );
  const base = slideMatch ? `slides.${ slideMatch[ 1 ] }.content` : "content";
  const eventScope = slideMatch ? `slide:${ slideMatch[ 1 ] }` : "global";

  const seed: Record<string, unknown> = {
    source
  };

  // A ranged readout inherits the control's own domain, so a 0..360 angle
  // slider yields a correctly-scaled gauge out of the box (same idea as
  // makeDefaultBinding seeding its mapping from the field config).
  if (
    ( kind === "hud-gauge" || kind === "hud-sparkline" ) &&
    ( config.component === "slider" || config.component === "number" )
  ) {
    const ranged = config as {
      min?: number;
      max?: number;
    };

    if ( typeof ranged.min === "number" ) {
      seed.min = ranged.min;
    }

    if ( typeof ranged.max === "number" ) {
      seed.max = ranged.max;
    }
  }

  const current = getValues( base );
  const items = Array.isArray( current ) ? current : [];
  const index = items.length;

  setValue(
    base,
    [
      ...items,
      makeDefaultItem(
        kind,
        seed
      )
    ],
    {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    }
  );

  // Same channel as pressing the element on canvas: opens the content band,
  // switches to the owning slide, and opens the layer's inspector.
  if ( typeof window !== "undefined" ) {
    window.dispatchEvent( new CustomEvent(
      CONTENT_ITEM_SELECT_EVENT,
      {
        detail: {
          scope: eventScope,
          index
        }
      }
    ) );
  }

  return `${ base }.${ index }`;
}
