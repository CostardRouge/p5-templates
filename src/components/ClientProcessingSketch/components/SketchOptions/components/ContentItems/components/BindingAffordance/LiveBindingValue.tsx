"use client";

import React, {
  useLayoutEffect, useRef
} from "react";
import {
  getBindingValues, subscribeBindingValues
} from "@/lib/channelBridge";

/**
 * The value a driven field is at right now, as text. It changes every frame, so
 * it never goes through React: the span is rendered empty and the bridge's
 * subscriber writes its text node directly, and only when the formatted text
 * actually changed. With no live value (paused before the first frame, a
 * source that is not arriving) it shows `fallback` — the field's base value.
 *
 * `labels` turns an enum's published index into the option's label; without
 * it the value is a number printed with `decimals`.
 */
export default function LiveBindingValue( {
  target,
  fallback,
  decimals = 0,
  labels,
  className
}: {
  target: string;
  fallback: string;
  decimals?: number;
  labels?: string[];
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

      const write = ( values: Record<string, number> ) => {
        const value = values[ target ];
        let text = fallback;

        if ( typeof value === "number" && Number.isFinite( value ) ) {
          text = list
            ? list[ Math.round( value ) ] ?? fallback
            : value.toFixed( decimals );
        }

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
      labelKey
    ]
  );

  return <span ref={ ref } className={ className } />;
}
