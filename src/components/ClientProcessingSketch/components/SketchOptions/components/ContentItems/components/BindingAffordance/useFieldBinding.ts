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
};

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

  for ( const binding of playing ) {
    const kind = binding.kind ?? "continuous";

    if ( kind === "continuous" && finite( binding.mapping?.min ) && finite( binding.mapping?.max ) ) {
      const low = Math.min(
        binding.mapping.min,
        binding.mapping.max
      );
      const high = Math.max(
        binding.mapping.min,
        binding.mapping.max
      );

      range = range
        ? {
          min: Math.min(
            range.min,
            low
          ),
          max: Math.max(
            range.max,
            high
          )
        }
        : {
          min: low,
          max: high
        };
    } else if ( kind === "enum" && Array.isArray( binding.mapping?.values ) ) {
      values = binding.mapping.values;
    }
  }

  return {
    target,
    bound: own.length > 0,
    live: playing.length > 0,
    range,
    values
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
