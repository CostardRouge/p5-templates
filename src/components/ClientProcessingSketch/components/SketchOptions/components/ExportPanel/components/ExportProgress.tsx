"use client";

import React from "react";
import clsx from "clsx";
import {
  PHASE_LABEL, phasesFor
} from "@/lib/export/progress";
import {
  formatBytes
} from "@/lib/export/download";
import {
  useSmoothFill
} from "@/hooks/useSmoothFill";
import type {
  ExportItemState
} from "@/lib/export/runExportBatch";
import type {
  ExportVariant
} from "@/lib/export/variants";

/**
 * A space exactly as wide as a digit, and — unlike an ASCII space — one HTML
 * does not collapse.
 *
 * It is what lets `7/450` and `172/450` occupy the same box with no
 * `white-space` rule and no measuring: the counter is padded to the total's
 * width once, in `formatFrames`.
 */
const FIGURE_SPACE = " ";

/** `172/450`, padded so the string's width never changes during a run. */
export function formatFrames(
  frame: number, totalFrames: number
): string {
  const padded = String( frame ).padStart(
    String( totalFrames ).length,
    FIGURE_SPACE
  );

  return `${ padded }/${ totalFrames }`;
}

/**
 * What a variant's status cell says, in a width that does not move.
 *
 * The runner reports a phase and two numbers, never a sentence — so the label
 * is built here, where the layout that has to absorb it is. `Capturing` shows
 * the padded frame counter and nothing else: the percentage it used to print
 * alongside is already drawn, twice, by the row's fill and the phase meter.
 */
export function statusLabel(
  state: ExportItemState, delivered: boolean
): string {
  if ( state.status === "failed" ) {
    return "✗ Failed";
  }

  if ( state.status === "cancelled" ) {
    return "Cancelled";
  }

  if ( state.status === "done" ) {
    const size = state.bytes === undefined ? "Done" : formatBytes( state.bytes );

    return `${ delivered ? "✓" : "·" } ${ size }`;
  }

  if ( state.status === "queued" ) {
    return "Queued";
  }

  if ( state.phase === "capturing" && state.totalFrames ) {
    return formatFrames(
      state.frame ?? 0,
      state.totalFrames
    );
  }

  return `${ PHASE_LABEL[ state.phase ] }…`;
}

/**
 * The run's progress, drawn as an inversion sweeping across the whole row.
 *
 * A literal white layer in `difference` inverts everything under it, which is
 * why this is one element and not a duplicated, clipped copy of the row: the
 * ground turns to ink and the ink turns to ground, in both themes, with no
 * second DOM tree to keep in step and no per-theme colour to pick. It must stay
 * `bg-white` for that reason — a themed token would make the blend a colour
 * shift rather than an inversion.
 *
 * The host row owns `relative isolate` and an opaque background: the isolation
 * keeps the blend inside the row, and the opaque ground is what it blends
 * against.
 *
 * Red never appears inside a row (it is reserved for capture in progress, and
 * lives in the footer's Stop button) — which matters here, because `difference`
 * would turn it cyan.
 */
export function ProgressWipe( {
  percentage
}: {
  percentage: number;
} ) {
  const fillRef = useSmoothFill<HTMLSpanElement>(
    true,
    percentage
  );

  return (
    <span
      ref={ fillRef }
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 bg-white mix-blend-difference"
      style={ {
        width: "0%"
      } }
    />
  );
}

type PhaseMeterProps = {
  kind: ExportVariant[ "kind" ];
  state: ExportItemState;
  className?: string;
};

/**
 * One segment per phase the variant really goes through.
 *
 * It answers the question a single bar cannot: *what* is taking the time. A
 * still shows three segments because it never encodes; an mp4 shows four. The
 * active segment fills when the phase reports a number and sweeps when it
 * cannot — the encoder emits one event and then blocks, and a sweep says
 * "working, no idea how long" where a bar frozen at 100% said "hung".
 */
export default function PhaseMeter( {
  kind,
  state,
  className
}: PhaseMeterProps ) {
  const phases = phasesFor( kind );
  const current = phases.indexOf( state.phase );
  const running = state.status === "running";

  return (
    <div
      aria-hidden="true"
      className={ clsx(
        "flex w-full gap-[3px]",
        className
      ) }
    >
      {phases.map( (
        phase, index
      ) => {
        const filled = state.status === "done" || ( running && index < current );
        const active = running && index === current;

        return (
          <div
            key={ phase }
            className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/15"
          >
            {filled && <span className="absolute inset-0 bg-foreground" />}

            {active && state.phaseProgress === null && (
              <span className="absolute inset-y-0 left-0 w-1/3 animate-phase-sweep bg-foreground motion-reduce:inset-x-0 motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
            )}

            {active && state.phaseProgress !== null && (
              <span
                className="absolute inset-y-0 left-0 bg-foreground"
                style={ {
                  width: `${ Math.round( state.phaseProgress * 100 ) }%`
                } }
              />
            )}
          </div>
        );
      } )}
    </div>
  );
}
