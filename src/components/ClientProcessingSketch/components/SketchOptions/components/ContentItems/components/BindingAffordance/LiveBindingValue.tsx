"use client";

import React, {
  useLayoutEffect, useRef
} from "react";
import {
  type BindingValue, getBindingValues, subscribeBindingValues
} from "@/lib/channelBridge";
import rgbaToHex from "../ControlledColorInput/utils/rgbaToHex";

// The text for one published value, or null when it has none to show.
function formatValue(
  value: BindingValue | undefined, {
    decimals, list, axis, hex
  }: {
    decimals: number;
    list: string[] | null;
    axis?: "x" | "y";
    hex: boolean;
  }
): string | null {
  if ( hex ) {
    return Array.isArray( value ) ? rgbaToHex( value ) : null;
  }

  const number = axis && value && typeof value === "object" && !Array.isArray( value )
    ? value[ axis ]
    : value;

  if ( typeof number !== "number" || !Number.isFinite( number ) ) {
    return null;
  }

  return list ? list[ Math.round( number ) ] ?? null : number.toFixed( decimals );
}

/**
 * The value a driven field is at right now, as text. It changes every frame, so
 * it never goes through React: the span is rendered empty and the bridge's
 * subscriber writes its text node directly, and only when the formatted text
 * actually changed. With no live value (paused before the first frame, a
 * source that is not arriving) it shows `fallback` — the field's base value.
 *
 * `labels` turns an enum's published index into the option's label, `axis`
 * picks one coordinate of a pad's `{ x, y }`, `hex` prints a colour's bytes as
 * `#rrggbb`; otherwise the value is a number printed with `decimals`.
 */
export default function LiveBindingValue( {
  target,
  fallback,
  decimals = 0,
  labels,
  axis,
  hex = false,
  className
}: {
  target: string;
  fallback: string;
  decimals?: number;
  labels?: string[];
  axis?: "x" | "y";
  hex?: boolean;
  className?: string;
} ) {
  const ref = useRef<HTMLSpanElement>( null );
  // A stable dependency for the list, which is rebuilt on every render.
  const labelKey = labels ? labels.join( "\u0000" ) : null;

  useLayoutEffect(
    () => {
      const node = ref.current;

      if ( !node ) {
        return;
      }

      const list = labelKey === null ? null : labelKey.split( "\u0000" );
      let shown: string | null = null;

      const write = ( values: Record<string, BindingValue> ) => {
        const text = formatValue(
          values[ target ],
          {
            decimals,
            list,
            axis,
            hex
          }
        ) ?? fallback;

        if ( text !== shown ) {
          node.textContent = text;
          shown = text;
        }
      };

      write( getBindingValues() );

      return subscribeBindingValues( write );
    },
    [
      target,
      fallback,
      decimals,
      labelKey,
      axis,
      hex
    ]
  );

  return <span ref={ ref } className={ className } />;
}
