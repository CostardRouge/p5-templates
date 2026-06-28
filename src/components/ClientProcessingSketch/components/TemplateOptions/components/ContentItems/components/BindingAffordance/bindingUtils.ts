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

// The Input source list is data-driven from the interaction handler's manifest
// (a pure module — importing it does NOT pull the handler/MediaPipe into the
// editor bundle). Adding a source there makes it bindable here automatically.
import {
  INTERACTION_SOURCES
} from "@/p5/utils/interaction/sources.js";
import {
  channelVarName
} from "@/lib/channelBridge";
import type {
  FieldConfig
} from "../../constants/field-config";

export type BindingKind = "continuous" | "vector2d";

export type BlendMode =
  | "replace"
  | "add"
  | "multiply"
  | "max"
  | "min"
  | "average";

export type Binding = {
  id?: string;
  source: string;
  project?: string;
  target: string;
  kind: BindingKind;
  mapping?: any;
  smoothing?: number;
  enabled?: boolean;
  // ── Layering (multiple bindings per parameter) ──
  /** Layer opacity / dry-wet, 0..1 (default 1). */
  weight?: number;
  /** How this layer combines with the ones beneath it (default "replace"). */
  blend?: BlendMode;
  /** Mixer solo: when any binding is soloed, only soloed ones play. */
  solo?: boolean;
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

const DESCRIPTORS = INTERACTION_SOURCES as ChannelDescriptor[];

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

export type SourceGroup = {
  /** Stable group key (the family base id, e.g. "mouse", "audio"). */
  key: string;
  /** Heading shown on the native <optgroup>. */
  label: string;
  options: SourceOption[];
};

/** Family label for a (possibly dotted) source id — "audio.bass" → "Audio". */
function sourceFamilyLabel( sourceId: string ): string {
  const base = String( sourceId ).split( "." )[ 0 ];
  const descriptor = DESCRIPTORS.find( ( d ) => d.id === base );

  return descriptor ? descriptor.label : base;
}

/**
 * The same options as {@link channelSourceOptions}, bucketed by family for a
 * native `<optgroup>` picker. A vector2d source's four projections
 * (X / Y / Magnitude / Angle) and audio's semantic scalars (level / bass / …)
 * sit under one heading instead of flooding a flat list. Group order follows
 * the source manifest; option order within a group is preserved.
 */
export function channelSourceGroups( kind: BindingKind ): SourceGroup[] {
  const groups: SourceGroup[] = [];
  const byKey = new Map<string, SourceGroup>();

  for ( const option of channelSourceOptions( kind ) ) {
    const key = String( option.source ).split( "." )[ 0 ];

    let group = byKey.get( key );

    if ( !group ) {
      group = {
        key,
        label: sourceFamilyLabel( option.source ),
        options: []
      };
      byKey.set(
        key,
        group
      );
      groups.push( group );
    }

    group.options.push( option );
  }

  return groups;
}

/**
 * The option's label with its family prefix stripped ("Audio · Bass" → "Bass"),
 * for display under an `<optgroup>` whose heading already names the family.
 * Falls back to the full label when there is no projection/scalar suffix.
 */
export function sourceOptionShortLabel( option: SourceOption ): string {
  const idx = option.label.lastIndexOf( " · " );

  return idx >= 0 ? option.label.slice( idx + 3 ) : option.label;
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
      enabled: true,
      weight: 1,
      blend: "replace"
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
    enabled: true,
    weight: 1,
    blend: "replace"
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

/**
 * The `interaction.*` boolean flag paths (relative to a sketch's `interaction`
 * object) to switch ON so a freshly-picked input source actually produces a
 * channel — "pick a source → it works". Vision sources (hands / face / …) need
 * the camera AND their tracker; the semantic audio scalars (audio.bass,
 * audio.level, …) need the mic AND the named-bands feature; the rest just need
 * their own `enabled` flag. Generators and unknown ids have no source to enable
 * and return an empty list.
 *
 * Mirrors the per-source `enabled` guards the interaction handler's collectors
 * check (see the `_collect*` functions in `@/p5/utils/interaction/index.js`).
 */
export function interactionEnablePaths( source: string ): string[] {
  // Semantic audio scalars: mic on + named-bands feature computed.
  if ( source.startsWith( "audio." ) ) {
    return [
      "enabled",
      "audio.enabled",
      "audio.features.bands"
    ];
  }

  switch ( source ) {
    case "hands":
    case "fingers":
    case "face":
    case "body":
      return [
        "enabled",
        "vision.enabled",
        `vision.${ source }.enabled`
      ];

    case "audio":
      return [
        "enabled",
        "audio.enabled"
      ];

    case "mouse":
    case "touch":
    case "orbit":
    case "perlinNoise":
    case "gyroscope":
    case "midi":
    case "joypad":
      return [
        "enabled",
        `${ source }.enabled`
      ];

    default:
      // Generators (oscillator / ramp / sequence / noise / random) and unknown
      // ids have no interaction source to enable.
      return [];
  }
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

// ── Layering UI ──────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHT = 1;

export const BLEND_OPTIONS: Array<{
  value: BlendMode;
  label: string;
}> = [
  {
    value: "replace",
    label: "Replace"
  },
  {
    value: "add",
    label: "Add"
  },
  {
    value: "multiply",
    label: "Multiply"
  },
  {
    value: "max",
    label: "Max"
  },
  {
    value: "min",
    label: "Min"
  },
  {
    value: "average",
    label: "Average"
  }
];

/** A short, human label for a binding's source — for the matrix / layer rows. */
export function bindingSourceLabel( binding: Binding ): string {
  if ( sourceCategory( binding.source ) !== "input" ) {
    return binding.source.charAt( 0 ).toUpperCase() + binding.source.slice( 1 );
  }

  const base = String( binding.source ).split( "." )[ 0 ];
  const descriptor =
    DESCRIPTORS.find( ( d ) => d.id === binding.source ) ??
    DESCRIPTORS.find( ( d ) => d.id === base );
  const familyLabel = descriptor ? descriptor.label : binding.source;

  if ( binding.project ) {
    const suffix =
      PROJECTIONS.find( ( p ) => p.project === binding.project )?.suffix ??
      binding.project;

    return `${ familyLabel } · ${ suffix }`;
  }

  return familyLabel;
}

/** A human label for a sketch-relative target path: "ring.radius" → "Ring radius". */
export function humanizeTarget( target: string ): string {
  const words = String( target )
    .split( "." )
    .join( " " )
    .replace(
      /([a-z0-9])([A-Z])/g,
      "$1 $2"
    )
    .toLowerCase()
    .trim();

  return words.charAt( 0 ).toUpperCase() + words.slice( 1 );
}
