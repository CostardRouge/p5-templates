/**
 * Helpers shared by the binding affordance: mapping a form field path to a
 * sketch-relative binding target, and building the interaction-channel source
 * catalogue (with the vector2d → scalar projections expanded).
 *
 * Mirrors the binding resolver's model (`@/p5/utils/interaction/bindings.js`):
 * a binding `target` is a dotted path *relative to the sketch settings object*,
 * a `source` is a channel id, and `project` (x|y|mag|angle) reconciles a
 * vector2d channel to a scalar target.
 */

import {
  CHANNEL_DESCRIPTORS
} from "@/p5/utils/interaction/channels.js";
import {
  channelVarName
} from "@/lib/channelBridge";
import type {
  FieldConfig
} from "../../constants/field-config";

export type BindingKind = "continuous" | "vector2d";

export type Binding = {
  id?: string;
  source: string;
  project?: string;
  target: string;
  kind: BindingKind;
  mapping?: any;
  smoothing?: number;
  enabled?: boolean;
  // Generator params, present when `source` is the matching generator.
  oscillator?: {
    wave?: string;
    cycles?: number;
    phase?: number;
  };
  ramp?: {
    easing?: string;
    count?: number;
    phase?: number;
    yoyo?: boolean;
  };
  sequence?: {
    stops?: number[];
    cycles?: number;
    phase?: number;
    mode?: string;
    easing?: string;
    hold?: number;
  };
  noise?: {
    speed?: number;
    seed?: number;
  };
  random?: {
    steps?: number;
    seed?: number;
    phase?: number;
  };
};

type ChannelDescriptor = {
  id: string;
  type: "scalar" | "vector2d";
  label: string;
};

export type SourceOption = {
  /** Stable encoded value for the <select> ("mouse::x", "osc::"). */
  value: string;
  label: string;
  source: string;
  project?: string;
  /** CSS var the VU meter reads for this source. */
  varName: string;
};

const DESCRIPTORS = CHANNEL_DESCRIPTORS as ChannelDescriptor[];

const PROJECTIONS = [
  {
    project: "x",
    suffix: "X"
  },
  {
    project: "y",
    suffix: "Y"
  },
  {
    project: "mag",
    suffix: "Magnitude"
  },
  {
    project: "angle",
    suffix: "Angle"
  }
];

/** Encode / decode a (source, project) pair for the source <select>. */
export function encodeSource(
  source: string, project?: string
): string {
  return `${ source }::${ project ?? "" }`;
}

export function decodeSource( value: string ): {
  source: string;
  project?: string;
} {
  const [
    source,
    project
  ] = String( value ).split( "::" );

  return {
    source,
    project: project || undefined
  };
}

/**
 * The channel sources a target of the given kind can bind to.
 *  - continuous target: every scalar channel, plus each vector2d channel
 *    expanded into its x / y / magnitude / angle projections.
 *  - vector2d target: every vector2d channel, whole (passthrough).
 */
export function channelSourceOptions( kind: BindingKind ): SourceOption[] {
  const options: SourceOption[] = [];

  for ( const descriptor of DESCRIPTORS ) {
    if ( kind === "vector2d" ) {
      if ( descriptor.type === "vector2d" ) {
        options.push( {
          value: encodeSource( descriptor.id ),
          label: descriptor.label,
          source: descriptor.id,
          varName: channelVarName(
            descriptor.id,
            "mag"
          )
        } );
      }

      continue;
    }

    // Continuous target
    if ( descriptor.type === "scalar" ) {
      options.push( {
        value: encodeSource( descriptor.id ),
        label: descriptor.label,
        source: descriptor.id,
        varName: channelVarName( descriptor.id )
      } );
      continue;
    }

    for ( const {
      project, suffix
    } of PROJECTIONS ) {
      options.push( {
        value: encodeSource(
          descriptor.id,
          project
        ),
        label: `${ descriptor.label } · ${ suffix }`,
        source: descriptor.id,
        project,
        varName: channelVarName(
          descriptor.id,
          project
        )
      } );
    }
  }

  return options;
}

/** CSS var the VU meter should read for a given binding. */
export function bindingVarName( binding: Binding ): string {
  if ( binding.kind === "vector2d" ) {
    return channelVarName(
      binding.source,
      "mag"
    );
  }

  return channelVarName(
    binding.source,
    binding.project
  );
}

// ── Form-path ↔ sketch-relative-path mapping ────────────────────────────────

/**
 * The form path of the sketch-settings scope a field lives under, e.g.
 * "sketch.radius" → "sketch", "slides.2.sketch.position" → "slides.2.sketch".
 * Returns null when the field is not a sketch parameter (so non-bindable
 * panels — size, animation, … — show no affordance).
 */
export function getSketchScope( registeredName: string ): string | null {
  const parts = String( registeredName ).split( "." );
  const index = parts.indexOf( "sketch" );

  if ( index === -1 || index === parts.length - 1 ) {
    return null;
  }

  return parts.slice(
    0,
    index + 1
  ).join( "." );
}

/** The binding target (sketch-relative dotted path) for a field. */
export function toSketchRelativePath( registeredName: string ): string | null {
  const scope = getSketchScope( registeredName );

  if ( !scope ) {
    return null;
  }

  return String( registeredName ).slice( scope.length + 1 );
}

// ── Default binding factory ─────────────────────────────────────────────────

function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `b_${ Math.round( performance.now() ) }`;
}

/**
 * Build a sensible default binding for a field, pre-filling the mapping range
 * from the field's configured min/max so the modulation lands in a useful
 * range out of the box.
 */
export function makeDefaultBinding(
  target: string,
  kind: BindingKind,
  source: SourceOption,
  config: FieldConfig
): Binding {
  const anyConfig = config as any;

  if ( kind === "vector2d" ) {
    const min = anyConfig.min ?? 0;
    const max = anyConfig.max ?? 1;

    return {
      id: makeId(),
      source: source.source,
      target,
      kind: "vector2d",
      mapping: {
        x: {
          min: anyConfig.xAxis?.min ?? min,
          max: anyConfig.xAxis?.max ?? max
        },
        y: {
          min: anyConfig.yAxis?.min ?? min,
          max: anyConfig.yAxis?.max ?? max
        }
      },
      smoothing: 0.15,
      enabled: true
    };
  }

  return {
    id: makeId(),
    source: source.source,
    project: source.project,
    target,
    kind: "continuous",
    mapping: {
      min: anyConfig.min ?? 0,
      max: anyConfig.max ?? 1,
      curve: "linear"
    },
    smoothing: 0.2,
    enabled: true
  };
}

// ── Source categories (the popover's conditional group) ─────────────────────
// Inputs are sampled from the world (mouse, …); generators compute from the
// sketch's animation progression (oscillator, ramp). New categories — API,
// date, … — slot in here as another branch.

export type SourceCategory =
  | "input"
  | "oscillator"
  | "ramp"
  | "sequence"
  | "noise"
  | "random";

export const SOURCE_CATEGORIES: Array<{
  value: SourceCategory;
  label: string;
}> = [
  {
    value: "input",
    label: "Input"
  },
  {
    value: "oscillator",
    label: "Oscillator"
  },
  {
    value: "ramp",
    label: "Ramp"
  },
  {
    value: "sequence",
    label: "Sequence"
  },
  {
    value: "noise",
    label: "Noise"
  },
  {
    value: "random",
    label: "Random"
  }
];

export function sourceCategory( source: string | undefined ): SourceCategory {
  if (
    source === "oscillator" ||
    source === "ramp" ||
    source === "sequence" ||
    source === "noise" ||
    source === "random"
  ) {
    return source;
  }

  return "input";
}

export const SEQUENCE_MODE_OPTIONS = [
  {
    value: "step",
    label: "Step"
  },
  {
    value: "smooth",
    label: "Smooth"
  }
];

export const WAVE_OPTIONS = [
  {
    value: "sine",
    label: "Sine"
  },
  {
    value: "triangle",
    label: "Triangle"
  },
  {
    value: "square",
    label: "Square"
  },
  {
    value: "sawtooth",
    label: "Sawtooth"
  }
];

export const DEFAULT_OSCILLATOR = {
  wave: "sine",
  cycles: 1,
  phase: 0
};

export const DEFAULT_RAMP = {
  easing: "linear",
  count: 1,
  phase: 0,
  yoyo: false
};

// Stops are seeded by the caller from the field's own domain (e.g. [min, max]),
// since they live in the target parameter's units.
export function defaultSequence( stops: number[] ) {
  return {
    stops,
    cycles: 1,
    phase: 0,
    mode: "step",
    easing: "linear",
    hold: 0
  };
}

export const DEFAULT_NOISE = {
  speed: 1,
  seed: 0
};

export const DEFAULT_RANDOM = {
  steps: 4,
  seed: 0,
  phase: 0
};
