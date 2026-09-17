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
import {
  resolveAxes
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledVector2DInput/utils/vector2dMath";

/**
 * HUD quick-add: right-click a sketch control → add a HUD element already
 * bound to that control's key-path, skipping the palette + source-picker
 * round trip.
 *
 * Only sketch parameters qualify (`getSketchScope` — content-item forms,
 * canvas/animation and the interactive namespace are excluded), and the
 * offered kinds follow the **value shape** the control edits, since that is
 * what decides which widget can read it:
 *  - slider / number             → counter, gauge, sparkline
 *  - color                       → swatch
 *  - vector2d                    → the vector map
 *  - text / select / checkbox …  → the readout (prints whatever it carries)
 *
 * Adding a kind to the menu is one entry in QUICK_ADD_KINDS, plus a seed
 * branch below when the element can inherit something from the control.
 */

const QUICK_ADD_KINDS: Record<string, ItemKind[]> = {
  slider: [
    "hud-counter",
    "hud-gauge",
    "hud-sparkline"
  ],
  number: [
    "hud-counter",
    "hud-gauge",
    "hud-sparkline"
  ],
  color: [
    "hud-swatch"
  ],
  // A sketch vector is normalized in its own domain, which the map carries as
  // `space: "value"` + the control's own range — that is what crosshairs (a
  // canvas-pixel reticle) could not do, and why vector2d used to offer nothing.
  vector2d: [
    "hud-vector"
  ],
  // Non-numeric parameters: the readout prints strings, enums and booleans, so
  // "which font is this sketch using?" becomes a layer instead of a guess.
  text: [
    "hud-readout"
  ],
  textarea: [
    "hud-readout"
  ],
  select: [
    "hud-readout"
  ],
  checkbox: [
    "hud-readout"
  ],
  easing: [
    "hud-readout"
  ]
};

export function hudQuickAddKinds(
  registeredName: string,
  config: FieldConfig
): ItemKind[] {
  if ( getSketchScope( registeredName ) === null ) {
    return [];
  }

  return QUICK_ADD_KINDS[ config.component ] ?? [];
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

  // The map reads the parameter in its own units, so it inherits the pad's
  // resolved domain (defaults → allowNegative → shared → per-axis: never the
  // raw min/max, which a vector2d may not carry at all) and its vertical
  // orientation, so the layer reads like the control it was created from. The
  // two axes are collapsed into one square domain: the map is a square, and a
  // per-axis domain would distort it rather than inform it.
  if ( kind === "hud-vector" && config.component === "vector2d" ) {
    const {
      xAxis, yAxis
    } = resolveAxes( config );

    seed.space = "value";
    seed.min = Math.min(
      xAxis.min,
      yAxis.min
    );
    seed.max = Math.max(
      xAxis.max,
      yAxis.max
    );
    seed.yDown = config.yDown ?? false;
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
