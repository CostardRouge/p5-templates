/**
 * Centralized Recording Step Configuration
 *
 * This file defines all recording steps, their keys, labels, and order.
 * Any changes to step definitions should be made here — the UI components
 * are fully transparent to step keys and labels.
 */

import type {
  RecordingProgressionSteps
} from "@/types/recording.types";
import type {
  SlideOption
} from "@/types/sketch.types";

export interface StepDefinition {
  key: string;
  label: string;
  /** Controls display order within its group */
  order: number;
  /** Which top-level section this step belongs to */
  section: "recording" | "uploading";
  /**
   * When true, this step is shared across all slides (not per-slide).
   * Only relevant for multi-slide recordings.
   */
  shared?: boolean;
}

// ─── Step Definitions ────────────────────────────────────────────────────────

export const RECORDING_STEPS = {
  LAUNCHING_BROWSER: {
    key: "launching-browser",
    label: "Launching browser",
    order: 1,
    section: "recording" as const,
    shared: true
  },
  SAVING_FRAMES: {
    key: "saving-frames",
    label: "Capturing frames",
    order: 2,
    section: "recording" as const
  },
  ENCODING_FRAMES: {
    key: "encoding-frames",
    label: "Encoding video",
    order: 3,
    section: "recording" as const
  }
} satisfies Record<string, StepDefinition>;

export const UPLOAD_STEPS = {
  ARCHIVING: {
    key: "archiving",
    label: "Archiving",
    order: 1,
    section: "uploading" as const
  },
  S3: {
    key: "s3",
    label: "Uploading to S3",
    order: 2,
    section: "uploading" as const
  }
} satisfies Record<string, StepDefinition>;

export const ALL_STEPS = {
  ...RECORDING_STEPS,
  ...UPLOAD_STEPS
} satisfies Record<string, StepDefinition>;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Map of step key → label, built from the definitions above */
export const STEP_LABEL_MAP: Record<string, string> = Object.values( ALL_STEPS ).reduce(
  (
    acc, step
  ) => {
    acc[ step.key ] = step.label;
    return acc;
  },
  {} as Record<string, string>
);

/** Returns the human-readable label for a step key, falling back to the key itself */
export function getStepLabel( stepKey: string ): string {
  return STEP_LABEL_MAP[ stepKey ] ?? stepKey;
}

// ─── Path builders ────────────────────────────────────────────────────────────

export function buildStepPath( ...parts: ( string | number )[] ): string {
  return parts.join( "." );
}

export function buildRecordingStepPath( stepKey: string ): string {
  return buildStepPath(
    "recording",
    stepKey
  );
}

export function buildSlideStepPath(
  slideIndex: number, stepKey: string
): string {
  return buildStepPath(
    "recording",
    `slide-${ slideIndex }`,
    stepKey
  );
}

export function buildUploadStepPath( stepKey: string ): string {
  return buildStepPath(
    "uploading",
    stepKey
  );
}

// ─── UI State resolver ────────────────────────────────────────────────────────

export type StepUIStatus = "pending" | "active" | "completed";

export interface FlatStepUI {
  key: string;
  label: string;
  percentage: number;
  status: StepUIStatus;
}

export interface SlideUI {
  index: number;
  name: string;
  status: StepUIStatus;
  /** Average percentage across all sub-steps */
  aggregate: number;
  subSteps: FlatStepUI[];
}

export interface ProgressionUIState {
  /** Human-readable label for the currently active step */
  currentLabel: string;
  /** True when the step tree contains per-slide entries */
  isMultiSlide: boolean;
  /** Shared steps that appear before the per-slide section (e.g. launching browser) */
  sharedLeadingSteps: FlatStepUI[];
  /** Per-slide rows (only populated when isMultiSlide is true) */
  slides: SlideUI[];
  /** Shared steps that appear after the per-slide section (e.g. uploading) */
  sharedTrailingSteps: FlatStepUI[];
  /** Flat list of steps for single-recording display */
  flatSteps: FlatStepUI[];
}

function stepStatus( percentage: number ): StepUIStatus {
  if ( percentage >= 100 ) {
    return "completed";
  }
  if ( percentage > 0 ) {
    return "active";
  }
  return "pending";
}

/**
 * Resolves the raw RecordingProgressionSteps tree into a typed UI state.
 *
 * The component only consumes this output — it has zero knowledge of step keys,
 * labels, or tree structure. Adding, removing, or renaming steps only requires
 * changes to the definitions above.
 */
export function resolveProgressionUIState(
  recordingSteps: RecordingProgressionSteps,
  currentSlideIndex: number | undefined,
  slideOptions: SlideOption[] | undefined
): ProgressionUIState {
  const rec = ( recordingSteps.recording as any );
  const uploading = ( recordingSteps.uploading as any );
  const recSteps: Record<string, any> = rec?.steps ?? {};

  // ── Detect multi-slide ──────────────────────────────────────────────────
  const slideKeys = Object.keys( recSteps )
    .filter( ( k ) => k.startsWith( "slide-" ) )
    .sort();
  const isMultiSlide = slideKeys.length > 0;

  // ── Shared leading steps (non-slide entries in recording section) ────────
  // Walk in definition order so the display order matches the config
  const sharedLeadingSteps: FlatStepUI[] = Object.values( RECORDING_STEPS )
    .filter( ( def ) => ( def as StepDefinition ).shared && recSteps[ def.key ] !== undefined )
    .sort( (
      a, b
    ) => a.order - b.order )
    .map( ( def ) => {
      const pct: number = recSteps[ def.key ]?.percentage ?? 0;

      return {
        key: def.key,
        label: def.label,
        percentage: pct,
        status: stepStatus( pct )
      };
    } );

  // ── Flat steps for single recordings ────────────────────────────────────
  // Walk all non-slide entries in the recording section, then uploading
  const flatSteps: FlatStepUI[] = [];

  // recording section — ordered by definition
  Object.values( RECORDING_STEPS )
    .filter( ( def ) => recSteps[ def.key ] !== undefined )
    .sort( (
      a, b
    ) => a.order - b.order )
    .forEach( ( def ) => {
      const pct: number = recSteps[ def.key ]?.percentage ?? 0;

      flatSteps.push( {
        key: def.key,
        label: def.label,
        percentage: pct,
        status: stepStatus( pct )
      } );
    } );

  // uploading section — flat percentage or nested steps
  if ( uploading ) {
    if ( uploading.steps ) {
      Object.values( UPLOAD_STEPS )
        .filter( ( def ) => uploading.steps[ def.key ] !== undefined )
        .sort( (
          a, b
        ) => a.order - b.order )
        .forEach( ( def ) => {
          const pct: number = uploading.steps[ def.key ]?.percentage ?? 0;

          flatSteps.push( {
            key: def.key,
            label: def.label,
            percentage: pct,
            status: stepStatus( pct )
          } );
        } );
    } else if ( typeof uploading.percentage === "number" ) {
      flatSteps.push( {
        key: "uploading",
        label: "Uploading",
        percentage: uploading.percentage,
        status: stepStatus( uploading.percentage )
      } );
    }
  }

  // ── Per-slide rows ───────────────────────────────────────────────────────
  const slides: SlideUI[] = slideKeys.map( (
    key, idx
  ) => {
    const ss: Record<string, any> = recSteps[ key ]?.steps ?? {};

    // Sub-steps ordered by definition
    const subSteps: FlatStepUI[] = Object.values( RECORDING_STEPS )
      .filter( ( def ) => !( def as StepDefinition ).shared && ss[ def.key ] !== undefined )
      .sort( (
        a, b
      ) => a.order - b.order )
      .map( ( def ) => {
        const pct: number = ss[ def.key ]?.percentage ?? 0;

        return {
          key: def.key,
          label: def.label,
          percentage: pct,
          status: stepStatus( pct )
        };
      } );

    // Also include any unknown sub-steps not in the config (future-proof)
    Object.keys( ss ).forEach( ( subKey ) => {
      if ( !subSteps.find( ( s ) => s.key === subKey ) ) {
        const pct: number = ss[ subKey ]?.percentage ?? 0;

        subSteps.push( {
          key: subKey,
          label: getStepLabel( subKey ),
          percentage: pct,
          status: stepStatus( pct )
        } );
      }
    } );

    const aggregate =
      subSteps.length === 0
        ? 0
        : Math.round( subSteps.reduce(
          (
            sum, s
          ) => sum + s.percentage,
          0
        ) / subSteps.length );

    let status: StepUIStatus = "pending";

    if ( currentSlideIndex !== undefined ) {
      if ( idx < currentSlideIndex ) {
        status = "completed";
      } else if ( idx === currentSlideIndex ) {
        status = "active";
      }
    }

    return {
      index: idx,
      name: slideOptions?.[ idx ]?.name ?? `Slide ${ idx + 1 }`,
      status,
      aggregate,
      subSteps
    };
  } );

  // ── Shared trailing steps (uploading section for multi-slide) ────────────
  const sharedTrailingSteps: FlatStepUI[] = [];

  if ( uploading?.steps ) {
    Object.values( UPLOAD_STEPS )
      .filter( ( def ) => uploading.steps[ def.key ] !== undefined )
      .sort( (
        a, b
      ) => a.order - b.order )
      .forEach( ( def ) => {
        const pct: number = uploading.steps[ def.key ]?.percentage ?? 0;

        sharedTrailingSteps.push( {
          key: def.key,
          label: def.label,
          percentage: pct,
          status: stepStatus( pct )
        } );
      } );
  }

  // ── Current label ────────────────────────────────────────────────────────
  // Find the first step that hasn't completed yet, in display order
  const currentLabel = resolveCurrentLabel(
    sharedLeadingSteps,
    slides,
    sharedTrailingSteps,
    flatSteps,
    isMultiSlide,
    currentSlideIndex,
    slideOptions,
    uploading
  );

  return {
    currentLabel,
    isMultiSlide,
    sharedLeadingSteps,
    slides,
    sharedTrailingSteps,
    flatSteps
  };
}

function resolveCurrentLabel(
  sharedLeadingSteps: FlatStepUI[],
  slides: SlideUI[],
  sharedTrailingSteps: FlatStepUI[],
  flatSteps: FlatStepUI[],
  isMultiSlide: boolean,
  currentSlideIndex: number | undefined,
  slideOptions: SlideOption[] | undefined,
  uploading: any
): string {
  if ( isMultiSlide ) {
    // Check shared leading steps first
    const activeLeading = sharedLeadingSteps.find( ( s ) => s.status !== "completed" );

    if ( activeLeading ) {
      return activeLeading.label;
    }

    // Check active slide sub-steps
    if ( currentSlideIndex !== undefined ) {
      const activeSlide = slides[ currentSlideIndex ];

      if ( activeSlide ) {
        const activeSub = activeSlide.subSteps.find( ( s ) => s.status !== "completed" );

        if ( activeSub ) {
          return `${ activeSlide.name } — ${ activeSub.label }`;
        }
      }
    }

    // Check trailing (upload) steps
    const activeTrailing = sharedTrailingSteps.find( ( s ) => s.status !== "completed" );

    if ( activeTrailing ) {
      return activeTrailing.label;
    }
  } else {
    // Single recording: walk flat steps in order
    const activeFlat = flatSteps.find( ( s ) => s.status !== "completed" );

    if ( activeFlat ) {
      return activeFlat.label;
    }
  }

  // Fallback for flat uploading (no nested steps)
  if ( uploading && typeof uploading.percentage === "number" && uploading.percentage < 100 ) {
    return "Uploading";
  }

  return "Processing...";
}
