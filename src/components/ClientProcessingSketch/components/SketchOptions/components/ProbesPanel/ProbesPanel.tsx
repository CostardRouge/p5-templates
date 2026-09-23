"use client";

import React, {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  ChevronDown, Radio
} from "lucide-react";
import clsx from "clsx";

import {
  useDevActions
} from "@/hooks/useDevActions";
import {
  useLiveProbes
} from "@/hooks/useLiveProbes";
import {
  formatProbeValue, subscribeProbes, type ProbeSnapshot
} from "@/lib/probeBridge";
import {
  probeSourceId
} from "@/p5/utils/hud/keyPaths";

type Props = {
  /** Bottom offset override so the card clears the slide filmstrip (a CSS
   *  length; defaults to the plain bottom-4 float). Ignored when `stacked`. */
  bottomOffset?: string;
  /** Render as a plain flow child instead of self-positioning — the caller
   *  owns placement and width in a shared, bottom-anchored flex column (see
   *  SketchOptions.tsx), and this component only supplies its own chrome. */
  stacked?: boolean;
};

/**
 * The Probes inspector — every value the running sketch exposes from inside
 * its draw (`probe( name, value )`, see `@/p5/utils/probe.js`), with its live
 * reading and how many times it was written this frame.
 *
 * It is the discovery surface for the `probe:` sources the HUD pickers list,
 * and where a probe's misuse shows: a name written N times a frame is a fold,
 * not a value, and its count is flagged until the sketch says which fold it
 * means (`probe.fold`).
 *
 * Values are written straight into the DOM from the bridge's per-frame
 * snapshot; React renders only when a probe appears or disappears
 * (`useLiveProbes`). A dev affordance: gated on the studio's "Display dev
 * actions" toggle, and hidden entirely while the sketch publishes nothing.
 */
export default function ProbesPanel( {
  bottomOffset,
  stacked = false
}: Props ) {
  const {
    devActionsVisible
  } = useDevActions();
  const probes = useLiveProbes();
  const [
    expanded,
    setExpanded
  ] = useState( true );

  // One cell per probe name, filled by the subscription below without a render.
  const valueCells = useRef( new Map<string, HTMLElement>() );
  const countCells = useRef( new Map<string, HTMLElement>() );

  const bindValue = useCallback(
    ( name: string ) => ( element: HTMLElement | null ) => {
      if ( element ) {
        valueCells.current.set(
          name,
          element
        );
      } else {
        valueCells.current.delete( name );
      }
    },
    []
  );

  const bindCount = useCallback(
    ( name: string ) => ( element: HTMLElement | null ) => {
      if ( element ) {
        countCells.current.set(
          name,
          element
        );
      } else {
        countCells.current.delete( name );
      }
    },
    []
  );

  const live = devActionsVisible && probes.length > 0 && expanded;

  useEffect(
    () => {
      if ( !live ) {
        return;
      }

      const paint = ( snapshot: ProbeSnapshot ) => {
        for ( const entry of snapshot ) {
          const value = valueCells.current.get( entry.name );

          if ( value ) {
            value.textContent = formatProbeValue(
              entry.value,
              entry.decimals
            );
          }

          const count = countCells.current.get( entry.name );

          if ( count ) {
            count.textContent = entry.count > 1 ? `×${ entry.count }` : "";
          }
        }
      };

      return subscribeProbes( paint );
    },
    [
      live
    ]
  );

  if ( !devActionsVisible || probes.length === 0 ) {
    return null;
  }

  return (
    <div
      className={ clsx(
        "flex max-w-[calc(100vw-1rem)] flex-col glass border border-theme shadow-lg overflow-hidden rounded-2xl text-xs",
        stacked
          ? "w-full"
          : "absolute left-1/2 z-50 w-80 -translate-x-1/2",
        !stacked && !bottomOffset && "bottom-4"
      ) }
      style={ !stacked && bottomOffset ? {
        bottom: bottomOffset
      } : undefined }
    >
      <button
        type="button"
        onClick={ () => setExpanded( ( v ) => !v ) }
        className="flex items-center gap-2 px-3 py-2 text-foreground"
        aria-label={ expanded ? "Collapse probes" : "Expand probes" }
      >
        <Radio className="h-3.5 w-3.5" />
        <span>
          Probes · {probes.length}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform"
          style={ {
            transform: expanded ? "rotate(0deg)" : "rotate(180deg)"
          } }
        />
      </button>

      {expanded && (
        <div className="flex max-h-[60svh] flex-col gap-1 overflow-y-auto px-3 pb-3">
          {probes.map( ( probe ) => (
            <div
              key={ probe.name }
              className="flex items-center gap-2 rounded-lg border border-theme px-2 py-1.5"
              title={ probeSourceId( probe.name ) }
            >
              <span className="min-w-0 flex-1 truncate text-label">
                {probe.label ?? probe.name}
                {probe.fold !== "last" && (
                  <span className="ml-1 text-[0.6875rem] text-label/60">
                    {probe.fold}
                  </span>
                )}
              </span>
              <span
                ref={ bindCount( probe.name ) }
                className={ clsx(
                  "shrink-0 text-[0.6875rem] tabular-nums",
                  probe.fold === "last" ? "text-amber-400" : "text-label/50"
                ) }
                title={ probe.fold === "last"
                  ? "Written more than once a frame: the last write wins. Use probe.fold to say which fold you mean."
                  : "Writes folded this frame" }
              />
              <span
                ref={ bindValue( probe.name ) }
                className="shrink-0 tabular-nums text-foreground"
              >
                —
              </span>
              {probe.unit && (
                <span className="shrink-0 text-label/60">{probe.unit}</span>
              )}
            </div>
          ) )}
        </div>
      )}
    </div>
  );
}
