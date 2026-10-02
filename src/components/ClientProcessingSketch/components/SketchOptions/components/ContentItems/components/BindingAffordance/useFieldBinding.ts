"use client";

import {
  useWatch
} from "react-hook-form";
import {
  selectActiveBindings
} from "@/p5/utils/interaction/bindings.js";
import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";
import {
  type Binding,
  getSketchScope,
  interactiveScopeFor,
  toSketchRelativePath
} from "./bindingUtils";

/**
 * What a field's own control needs to know to show that it is driven — not the
 * binding editor's view (that is the popover), only the outline: is anything
 * playing on it, between which bounds, and over which options.
 */
export type FieldBindingState = {
  /** Sketch-relative target path, the key of the live value on the bridge. */
  target: string;
  /** At least one layer targets the field, playing or not. */
  bound: boolean;
  /** At least one layer plays (enabled, and not silenced by a solo). */
  live: boolean;
  /** Continuous: the union of the playing layers' mapping ranges. */
  range: { min: number;
    max: number } | null;
  /** Enum: the cycle of the last playing layer — the one that wins the fold. */
  values: unknown[] | null;
  /** 2D pad: the union of the playing layers' per-axis mapping ranges. */
  area: { x: { min: number;
    max: number };
  y: { min: number;
    max: number }; } | null;
  /** Colour: the last playing layer's two-stop ramp, `[r, g, b, a]` bytes. */
  ramp: { from: number[];
    to: number[] } | null;
};

type Span = { min: number;
  max: number };

// Widen `span` to cover [a, b] in either order; a missing bound reads as the
// resolver's own default, so the drawn span is the one it actually sweeps.
function widen(
  span: Span | null, a: unknown, b: unknown, fallbackA: number, fallbackB: number
): Span {
  const first = finite( a ) ? a : fallbackA;
  const second = finite( b ) ? b : fallbackB;
  const low = Math.min(
    first,
    second
  );
  const high = Math.max(
    first,
    second
  );

  return span
    ? {
      min: Math.min(
        span.min,
        low
      ),
      max: Math.max(
        span.max,
        high
      )
    }
    : {
      min: low,
      max: high
    };
}

function isRgba( value: unknown ): value is number[] {
  return Array.isArray( value ) && value.length >= 3 && value.slice(
    0,
    3
  ).every( finite );
}

function finite( value: unknown ): value is number {
  return typeof value === "number" && Number.isFinite( value );
}

/** Pure part of {@link useFieldBinding}, so it can be unit-tested. */
export function describeFieldBinding(
  list: Binding[] | undefined, target: string
): FieldBindingState {
  const all = Array.isArray( list ) ? list.filter( Boolean ) : [];
  const own = all.filter( ( binding ) => binding.target === target );
  // Solo is decided across the whole scope, as the resolver does: a solo on
  // another parameter silences this one.
  const playing = ( selectActiveBindings( all ) as Binding[] )
    .filter( ( binding ) => binding.target === target );

  let range: FieldBindingState[ "range" ] = null;
  let values: unknown[] | null = null;
  let areaX: Span | null = null;
  let areaY: Span | null = null;
  let ramp: FieldBindingState[ "ramp" ] = null;

  for ( const binding of playing ) {
    const kind = binding.kind ?? "continuous";
    const mapping = binding.mapping ?? {};

    if ( kind === "continuous" && finite( mapping.min ) && finite( mapping.max ) ) {
      range = widen(
        range,
        mapping.min,
        mapping.max,
        0,
        1
      );
    } else if ( kind === "enum" && Array.isArray( mapping.values ) ) {
      values = mapping.values;
    } else if ( kind === "vector2d" ) {
      areaX = widen(
        areaX,
        mapping.x?.min,
        mapping.x?.max,
        0,
        1
      );
      areaY = widen(
        areaY,
        mapping.y?.min,
        mapping.y?.max,
        0,
        1
      );
    } else if ( kind === "color" && isRgba( mapping.from ) && isRgba( mapping.to ) ) {
      ramp = {
        from: mapping.from,
        to: mapping.to
      };
    }
  }

  return {
    target,
    bound: own.length > 0,
    live: playing.length > 0,
    range,
    values,
    area: areaX && areaY
      ? {
        x: areaX,
        y: areaY
      }
      : null,
    ramp
  };
}

/**
 * The binding outline of the field at `fieldPath`, or null when the field
 * cannot be bound (plugin off, or not a sketch parameter). Watches the same
 * `interactive.bindings` array the pastille edits, so the control and the
 * pastille never disagree. Pass null to opt out without breaking hook order.
 */
export default function useFieldBinding( fieldPath: string | null ): FieldBindingState | null {
  const scope = fieldPath && interactionBindingsEnabled() ? getSketchScope( fieldPath ) : null;
  const target = scope && fieldPath ? toSketchRelativePath( fieldPath ) : null;
  const bindings = useWatch( {
    name: scope ? `${ interactiveScopeFor( scope ) }.bindings` : "__no_bindings__"
  } ) as Binding[] | undefined;

  if ( !scope || !target ) {
    return null;
  }

  return describeFieldBinding(
    bindings,
    target
  );
}
