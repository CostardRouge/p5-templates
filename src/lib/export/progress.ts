import type {
  ExportVariant
} from "./variants";

/**
 * The phases a variant goes through, in the order it goes through them.
 *
 * This list IS the meter the export panel draws: one segment per phase, the
 * finished ones full, the current one filling. Adding a phase here adds a
 * segment there — there is no second list to keep in step.
 */
export const EXPORT_PHASES = [
  "preparing",
  "capturing",
  "encoding",
  "saving"
] as const;

export type ExportPhase = ( typeof EXPORT_PHASES )[ number ];

/**
 * Roughly what each phase costs, relative to the others.
 *
 * These are weights, not measurements: an encode is not 17% of a run on every
 * sketch. What they buy is a bar that keeps moving through a phase the old one
 * had no number for — capture used to own the whole 0→100 and encoding then sat
 * pinned at 100% for as long as it took, which reads as a hang rather than as
 * work. They are normalised over the phases a variant actually has (below), so
 * a still — which never encodes — still ends at 100.
 */
const PHASE_WEIGHT: Record<ExportPhase, number> = {
  preparing: 4,
  capturing: 76,
  encoding: 17,
  saving: 3
};

/** What the panel calls each phase. */
export const PHASE_LABEL: Record<ExportPhase, string> = {
  preparing: "Preparing",
  capturing: "Capturing",
  encoding: "Encoding",
  saving: "Saving"
};

/**
 * The phases this kind of output really goes through.
 *
 * A still has no encoder and a frame sequence has no video encoder, so neither
 * gets an `encoding` segment: an empty segment that never fills reads as a
 * stalled step rather than as one that does not apply — the same reason a
 * column that does not apply to a variant shows a dash instead of a dead
 * control.
 */
export function phasesFor( kind: ExportVariant[ "kind" ] ): ExportPhase[] {
  if ( kind === "video" ) {
    return [
      ...EXPORT_PHASES
    ];
  }

  return [
    "preparing",
    "capturing",
    "saving"
  ];
}

function clamp01( value: number ): number {
  if ( !Number.isFinite( value ) ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

/**
 * How far through the whole variant a phase and a position inside it are, 0-1.
 *
 * `phases` comes from `phasesFor`, so the weights are normalised over the ones
 * that apply: capture ends at the same place whether or not an encode follows.
 */
export function phaseFraction(
  phases: ExportPhase[], phase: ExportPhase, within: number
): number {
  const total = phases.reduce(
    (
      sum, entry
    ) => sum + PHASE_WEIGHT[ entry ],
    0
  );

  if ( total <= 0 ) {
    return 0;
  }

  const index = phases.indexOf( phase );

  if ( index < 0 ) {
    return 0;
  }

  const before = phases.slice(
    0,
    index
  ).reduce(
    (
      sum, entry
    ) => sum + PHASE_WEIGHT[ entry ],
    0
  );

  return ( before + clamp01( within ) * PHASE_WEIGHT[ phase ] ) / total;
}
