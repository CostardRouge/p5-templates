"use client";

import React from "react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import {
  Activity, ChevronDown, Plus, RotateCcw, Trash2, X
} from "lucide-react";
import clsx from "clsx";
import {
  useFormContext, useWatch
} from "react-hook-form";
import type {
  FieldConfig
} from "../../constants/field-config";
import {
  bindingSignalVarName
} from "@/lib/channelBridge";
import ChannelMeter from "./ChannelMeter";
import ControlledSliderInput from "../ControlledSliderInput/ControlledSliderInput";
import ControlledEasingInput from "../ControlledEasingInput/ControlledEasingInput";
import {
  ToggleSwitch
} from "../ControlChrome";
import {
  interactionBindingsEnabled
} from "@/lib/interactionBindings";
// bindings.js is already a small, pure module statically imported by the
// engine runtime for every sketch (see options.js) — importing it here too is
// no added weight. defaults.js (the ~1000-line panel/values data) is dynamic
// -imported lazily inside enableSourceInputs below, so an editor session that
// never binds a live input source never pulls it into the client bundle.
import {
  needsInteractionBlock
} from "@/p5/utils/interaction/bindings.js";
import {
  type Binding,
  type BindingKind,
  type SourceCategory,
  BLEND_OPTIONS,
  DEFAULT_WEIGHT,
  bindingSourceLabel,
  channelSourceGroups,
  channelSourceOptions,
  sourceOptionShortLabel,
  decodeSource,
  defaultSequence,
  DEFAULT_NOISE,
  DEFAULT_OSCILLATOR,
  DEFAULT_RAMP,
  DEFAULT_RANDOM,
  encodeSource,
  getSketchScope,
  interactiveScopeFor,
  interactionEnablePaths,
  makeDefaultBinding,
  SEQUENCE_MODE_OPTIONS,
  SOURCE_CATEGORIES,
  sourceCategory,
  toSketchRelativePath,
  WAVE_OPTIONS
} from "./bindingUtils";

type Props = {
  fieldPath: string;
  component: FieldConfig[ "component" ];
  config: FieldConfig;
};

// Resolve the slider domain for the mapping-range controls from the field's
// own config, so a modulation range is dragged within the parameter's real
// domain. Falls back to a 0..1 fractional range.
function fieldDomain( config: FieldConfig ) {
  const anyConfig = config as any;
  const min = typeof anyConfig.min === "number" ? anyConfig.min : 0;
  const max = typeof anyConfig.max === "number" ? anyConfig.max : 1;
  const step =
    typeof anyConfig.step === "number"
      ? anyConfig.step
      : max - min <= 2
        ? 0.01
        : 1;

  return {
    min,
    max,
    step
  };
}

/**
 * The per-field modulation control. A small pastille sits beside a bindable
 * field (slider / number / vector2d). Bound, it is a live VU meter glowing with
 * the channel's activity; clicking it opens a popover to pick the source,
 * range, curve and smoothing — or to remove the binding.
 *
 * Bindings are stored as data at the sketch scope's paired `interactive`
 * namespace (`interactive.bindings` / `slides.N.interactive.bindings` — see
 * interactiveScopeFor), resolved at read time by the options proxy so binding
 * data never pollutes the sketch's own parameters. The mapping-range and
 * smoothing controls are real `ControlledSliderInput`s and the enable/invert
 * toggles are the shared `ToggleSwitch`, both bound to the binding's path in
 * the form so they behave exactly like every other control in the panel.
 */
export default function BindingAffordance( {
  fieldPath,
  component,
  config
}: Props ) {
  const {
    setValue, register, getValues
  } = useFormContext();

  const scope = getSketchScope( fieldPath );
  const target = toSketchRelativePath( fieldPath );
  // Binding data lives in the `interactive` namespace paired with the field's
  // sketch scope — never inside the sketch parameters themselves.
  const interactiveScope = scope ? interactiveScopeFor( scope ) : "";
  const bindingsPath = interactiveScope ? `${ interactiveScope }.bindings` : "";

  const bindings = useWatch( {
    name: bindingsPath || "__no_bindings__"
  } ) as Binding[] | undefined;

  // Which layer (binding) on this target the popover is currently editing.
  const [
    selLayer,
    setSelLayer
  ] = React.useState( 0 );

  // Off unless the interaction-bindings plugin is enabled, and only for sketch
  // parameters (so non-bindable panels — size, animation, … — show nothing).
  if ( !interactionBindingsEnabled() || !scope || !target ) {
    return null;
  }

  const kind: BindingKind = component === "vector2d" ? "vector2d" : "continuous";
  const list: Binding[] = Array.isArray( bindings ) ? bindings : [];

  // Every binding driving THIS parameter, with its index in the bindings array —
  // a parameter can be driven by multiple layered bindings.
  const layers = list
    .map( (
      b, i
    ) => ( {
      binding: b,
      index: i
    } ) )
    .filter( ( entry ) => entry.binding && entry.binding.target === target );
  const layerPos = Math.min(
    selLayer,
    Math.max(
      0,
      layers.length - 1
    )
  );
  const activeLayer = layers[ layerPos ];
  const index = activeLayer ? activeLayer.index : -1;
  const binding = activeLayer ? activeLayer.binding : undefined;
  const bound = layers.length > 0;
  const sourceOptions = channelSourceOptions( kind );
  const domain = fieldDomain( config );

  // The selected input source's full "Family · Detail" label — shown only on
  // the closed control, since the open list already groups by family under
  // an <optgroup> heading (a short label there would be redundant).
  const selectedSourceOption = binding && sourceOptions.find( ( option ) => option.value === encodeSource(
    binding.source,
    binding.project
  ) );
  const selectedSourceLabel = selectedSourceOption?.label ?? binding?.source ?? "";

  // Path of the selected binding object in the form; sub-fields (mapping.min,
  // smoothing, enabled…) are edited in place so they round-trip like any other
  // control.
  const bindingPath = `${ bindingsPath }.${ index }`;

  // Strip the plugin-managed `interaction` block once no binding needs it any
  // more — the inverse of enableSourceInputs' on-demand seed below. Checked
  // after every bindings-array write (add / remove / reset) and every source-
  // category switch, so a sketch never carries the block, or shows its
  // settings panel (gated the same way in GenericObjectForm), once its last
  // interactive binding is gone. Only the `interactive` namespace is pruned —
  // a sketch-DECLARED block at `${scope}.interaction` is a real sketch
  // parameter (hand-tracking, audio, …) and is never touched.
  const pruneInteractionIfUnused = ( nextList: Binding[] ) => {
    if ( needsInteractionBlock( nextList ) ) {
      return;
    }

    if ( getValues( `${ interactiveScope }.interaction` ) !== undefined ) {
      setValue(
        `${ interactiveScope }.interaction`,
        undefined,
        {
          shouldDirty: true
        }
      );
    }
  };

  const writeBindings = ( next: Binding[] ) => {
    setValue(
      bindingsPath,
      next,
      {
        shouldDirty: true
      }
    );
    pruneInteractionIfUnused( next );
  };

  const setField = (
    subPath: string, value: unknown
  ) => {
    setValue(
      `${ bindingPath }.${ subPath }`,
      value,
      {
        shouldDirty: true
      }
    );
  };

  // Picking an interaction input source should make it actually produce a
  // channel — flip the matching `interaction.*` enable flags on so the camera /
  // mic / sensor for that source boots immediately. The flags land wherever
  // the interaction block actually lives: a sketch-DECLARED block at the
  // sketch scope (hand-tracking, audio, … — their own panel and sketch code
  // read it, and the engine gives it precedence) is written in place;
  // otherwise the plugin-managed block in the `interactive` namespace is
  // seeded from an inert clone of the shared defaults on first use, then
  // flipped. The seed never touches sketch parameters, and is pruned again by
  // pruneInteractionIfUnused once no binding needs it.
  const enableSourceInputs = async( source: string ) => {
    let interactionScope = scope;

    if ( getValues( `${ scope }.interaction` ) === undefined ) {
      interactionScope = interactiveScope;

      if ( getValues( `${ interactiveScope }.interaction` ) === undefined ) {
        const {
          inertInteractionFormValues
        } = await import( "@/p5/utils/interaction/defaults.js" );

        setValue(
          `${ interactiveScope }.interaction`,
          inertInteractionFormValues(),
          {
            shouldDirty: true
          }
        );
      }
    }

    for ( const path of interactionEnablePaths( source ) ) {
      setValue(
        `${ interactionScope }.interaction.${ path }`,
        true,
        {
          shouldDirty: true
        }
      );
    }
  };

  // Append a new layer (binding) for this parameter and select it. The default
  // source is the baseline input (mouse) — an interactive binding as soon as
  // it exists, so it seeds/enables the interaction block like any explicit
  // source pick.
  const addLayer = () => {
    const first = sourceOptions[ 0 ];

    writeBindings( [
      ...list,
      makeDefaultBinding(
        target,
        kind,
        first,
        config
      )
    ] );
    setSelLayer( layers.length );
    void enableSourceInputs( first.source );
  };

  // Remove the selected layer, then select a remaining one.
  const removeLayer = () => {
    if ( index < 0 ) {
      return;
    }

    writeBindings( list.filter( (
      _, i
    ) => i !== index ) );
    setSelLayer( Math.max(
      0,
      layerPos - 1
    ) );
  };

  // Reset every modulation OPTION to its default, keeping the binding's source /
  // category choice (and id/target). Wipes range, easing, smoothing and the
  // active generator's params in one click.
  const resetAll = () => {
    if ( !binding ) {
      return;
    }

    const next: Binding = {
      id: binding.id,
      source: binding.source,
      project: binding.project,
      target: binding.target,
      kind: binding.kind,
      enabled: binding.enabled,
      // Layer identity (weight / blend / solo) survives a modulation reset.
      weight: binding.weight,
      blend: binding.blend,
      solo: binding.solo,
      smoothing: kind === "vector2d" ? 0.15 : 0.2,
      mapping: kind === "vector2d"
        ? {
          x: {
            min: domain.min,
            max: domain.max
          },
          y: {
            min: domain.min,
            max: domain.max
          }
        }
        : {
          min: domain.min,
          max: domain.max,
          curve: "linear"
        }
    };

    if ( binding.source === "oscillator" ) {
      next.oscillator = {
        ...DEFAULT_OSCILLATOR
      };
    } else if ( binding.source === "ramp" ) {
      next.ramp = {
        ...DEFAULT_RAMP
      };
    } else if ( binding.source === "sequence" ) {
      next.sequence = defaultSequence( [
        domain.min,
        domain.max
      ] );
    } else if ( binding.source === "noise" ) {
      next.noise = {
        ...DEFAULT_NOISE
      };
    } else if ( binding.source === "random" ) {
      next.random = {
        ...DEFAULT_RANDOM
      };
    }

    writeBindings( list.map( (
      b, i
    ) => ( i === index ? next : b ) ) );
  };

  // Switch the binding between source categories (input / oscillator / ramp),
  // seeding the generator's default params the first time it is selected.
  const switchCategory = ( next: SourceCategory ) => {
    if ( next === "oscillator" ) {
      setField(
        "source",
        "oscillator"
      );

      if ( !binding?.oscillator ) {
        setField(
          "oscillator",
          {
            ...DEFAULT_OSCILLATOR
          }
        );
      }
    } else if ( next === "ramp" ) {
      setField(
        "source",
        "ramp"
      );

      if ( !binding?.ramp ) {
        setField(
          "ramp",
          {
            ...DEFAULT_RAMP
          }
        );
      }
    } else if ( next === "sequence" ) {
      setField(
        "source",
        "sequence"
      );

      if ( !binding?.sequence ) {
        // Seed two stops from the field's domain so it does something at once.
        setField(
          "sequence",
          defaultSequence( [
            domain.min,
            domain.max
          ] )
        );
      }
    } else if ( next === "noise" ) {
      setField(
        "source",
        "noise"
      );

      if ( !binding?.noise ) {
        setField(
          "noise",
          {
            ...DEFAULT_NOISE
          }
        );
      }
    } else if ( next === "random" ) {
      setField(
        "source",
        "random"
      );

      if ( !binding?.random ) {
        setField(
          "random",
          {
            ...DEFAULT_RANDOM
          }
        );
      }
    } else {
      const first = sourceOptions[ 0 ];

      setField(
        "source",
        first.source
      );
      setField(
        "project",
        first.project ?? null
      );
      void enableSourceInputs( first.source );
    }

    // Switching THIS binding away from an input source may have removed the
    // scope's last reason to carry the interaction block — check with the
    // projected next source (the write above hasn't round-tripped through
    // form state yet within this same tick).
    if ( next !== "input" ) {
      pruneInteractionIfUnused( list.map( (
        b, i
      ) => ( i === index ? {
        ...b,
        source: next
      } : b ) ) );
    }
  };

  // Reset a sub-field to its default, mirroring the form's per-control revert.
  // Shows the revert icon only when the value differs from the default.
  const resetFor = (
    subPath: string, current: unknown, defaultValue: unknown
  ) => ( {
    isModified: JSON.stringify( current ) !== JSON.stringify( defaultValue ),
    onReset: ( e: React.MouseEvent ) => {
      e.preventDefault();
      e.stopPropagation();
      setField(
        subPath,
        defaultValue
      );
    }
  } );

  // Sequence stop list helpers (a simple scalable list of field-domain values).
  const stops: number[] = Array.isArray( binding?.sequence?.stops )
    ? ( binding!.sequence!.stops as number[] )
    : [];

  const addStop = () => {
    const mid = domain.step >= 1
      ? Math.round( ( domain.min + domain.max ) / 2 )
      : ( domain.min + domain.max ) / 2;

    setField(
      "sequence.stops",
      [
        ...stops,
        mid
      ]
    );
  };

  const removeStop = ( i: number ) => {
    setField(
      "sequence.stops",
      stops.filter( (
        _, j
      ) => j !== i )
    );
  };

  // The VU meter reads the binding's resolved 0..1 signal, published per-target
  // by the resolver — so it works for input channels AND generators alike.
  const meterVar = bindingSignalVarName( target );
  const category = sourceCategory( binding?.source );
  const enabled = binding?.enabled !== false;

  return (
    <Popover className="relative shrink-0">
      <PopoverButton
        title={ bound ? "Edit modulation" : "Bind to an interactive input" }
        onClick={ () => {
          // First click on an unbound field creates the first layer AND opens
          // the popover (no preventDefault) so it can be configured immediately.
          if ( !bound ) {
            addLayer();
          }
        } }
        className={ clsx(
          "relative grid h-7 w-7 place-items-center rounded-md border transition-colors outline-none focus-visible:ring-1 focus-visible:ring-focus",
          bound && enabled
            ? "border-focus/60 text-focus"
            : bound
              ? "border-theme text-label"
              : "border-theme text-label/60 hover:text-foreground hover:bg-hover"
        ) }
      >
        {/* Live VU glow behind the icon, driven purely by the binding's CSS var. */}
        {bound && enabled && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md bg-focus/30"
            style={ {
              opacity: `var(${ meterVar }, 0)`,
              transform: `scale(calc(0.4 + 0.6 * var(${ meterVar }, 0)))`
            } }
          />
        )}
        <Activity className="relative h-3.5 w-3.5" />
      </PopoverButton>

      <PopoverPanel
        anchor="bottom end"
        className="z-[60] w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-theme bg-background p-3 text-xs shadow-xl [--anchor-gap:0.4rem] [--anchor-padding:0.5rem]"
      >
        {( {
          close
        }: { close: () => void } ) => ( binding ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">Modulation</span>
                <button
                  type="button"
                  title="Reset all modulation settings"
                  onClick={ resetAll }
                  className="grid h-5 w-5 place-items-center rounded text-label transition-colors hover:bg-hover hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-label">
                <span>Enabled</span>
                <ToggleSwitch
                  inputProps={ register( `${ bindingPath }.enabled` ) }
                />
              </label>
            </div>

            {/* Layers — one chip per binding driving this parameter; the editor
                below configures the selected one. "+" stacks another layer. */}
            <div className="flex flex-wrap items-center gap-1">
              {layers.map( (
                entry, i
              ) => (
                <button
                  key={ entry.binding.id ?? i }
                  type="button"
                  onClick={ () => setSelLayer( i ) }
                  title={ bindingSourceLabel( entry.binding ) }
                  className={ clsx(
                    "flex items-center gap-1 rounded-md border px-1.5 py-1 transition-colors",
                    i === layerPos
                      ? "border-focus/60 text-focus"
                      : "border-theme text-label hover:text-foreground",
                    entry.binding.enabled === false && "opacity-50"
                  ) }
                >
                  <span className="max-w-[6rem] truncate">
                    {bindingSourceLabel( entry.binding )}
                  </span>
                  {entry.binding.solo && (
                    <span className="text-[0.65rem] font-bold text-amber-400">
                      S
                    </span>
                  )}
                </button>
              ) )}
              <button
                type="button"
                onClick={ addLayer }
                title="Add a layer"
                className="grid h-7 w-7 place-items-center rounded-md border border-dashed border-theme text-label transition-colors hover:bg-hover hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Source — a conditional group: pick a category, then its options.
                Input channels are sampled from the world; generators compute
                from the sketch's animation progression. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-label">Source</span>

              {/* Category selector (generators are continuous-only) */}
              {kind === "continuous" && (
                <select
                  value={ category }
                  onChange={ ( e ) =>
                    switchCategory( e.target.value as SourceCategory ) }
                  className="h-8 w-full rounded-md border border-theme bg-background px-2 text-foreground"
                >
                  {SOURCE_CATEGORIES.map( ( option ) => (
                    <option key={ option.value } value={ option.value }>
                      {option.label}
                    </option>
                  ) )}
                </select>
              )}

              {category === "input" && (
                <div className="relative">
                  {/* Visible, non-interactive: shows the full "Family · Detail"
                      label so the source's group stays legible once collapsed —
                      the native <select> below would otherwise only echo back
                      the short, group-less option text. */}
                  <div
                    aria-hidden
                    className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-theme bg-background px-2 text-foreground"
                  >
                    <span className="truncate">{selectedSourceLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-label" />
                  </div>
                  <select
                    value={ encodeSource(
                      binding.source,
                      binding.project
                    ) }
                    onChange={ ( e ) => {
                      const {
                        source, project
                      } = decodeSource( e.target.value );

                      setField(
                        "source",
                        source
                      );
                      setField(
                        "project",
                        project ?? null
                      );
                      void enableSourceInputs( source );
                    } }
                    aria-label="Source"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  >
                    {channelSourceGroups( kind ).map( ( group ) => (
                      <optgroup key={ group.key } label={ group.label }>
                        {group.options.map( ( option ) => (
                          <option key={ option.value } value={ option.value }>
                            {sourceOptionShortLabel( option )}
                          </option>
                        ) )}
                      </optgroup>
                    ) )}
                  </select>
                </div>
              )}

              {category === "oscillator" && (
                <>
                  <select
                    value={ binding.oscillator?.wave ?? "sine" }
                    onChange={ ( e ) => setField(
                      "oscillator.wave",
                      e.target.value
                    ) }
                    className="h-8 w-full rounded-md border border-theme bg-background px-2 text-foreground"
                  >
                    {WAVE_OPTIONS.map( ( option ) => (
                      <option key={ option.value } value={ option.value }>
                        {option.label}
                      </option>
                    ) )}
                  </select>
                  <ControlledSliderInput
                    name={ `${ bindingPath }.oscillator.cycles` }
                    label="Cycles"
                    min={ 1 }
                    max={ 9 }
                    step={ 1 }
                    { ...resetFor(
                      "oscillator.cycles",
                      binding.oscillator?.cycles,
                      DEFAULT_OSCILLATOR.cycles
                    ) }
                  />
                  <ControlledSliderInput
                    name={ `${ bindingPath }.oscillator.phase` }
                    label="Phase"
                    min={ 0 }
                    max={ 1 }
                    step={ 0.01 }
                    { ...resetFor(
                      "oscillator.phase",
                      binding.oscillator?.phase,
                      DEFAULT_OSCILLATOR.phase
                    ) }
                  />
                </>
              )}

              {category === "ramp" && (
                <>
                  <ControlledEasingInput
                    name={ `${ bindingPath }.ramp.easing` }
                    label="Easing"
                    { ...resetFor(
                      "ramp.easing",
                      binding.ramp?.easing,
                      DEFAULT_RAMP.easing
                    ) }
                  />
                  <ControlledSliderInput
                    name={ `${ bindingPath }.ramp.count` }
                    label="Count"
                    min={ 1 }
                    max={ 9 }
                    step={ 1 }
                    { ...resetFor(
                      "ramp.count",
                      binding.ramp?.count,
                      DEFAULT_RAMP.count
                    ) }
                  />
                  <ControlledSliderInput
                    name={ `${ bindingPath }.ramp.phase` }
                    label="Phase"
                    min={ 0 }
                    max={ 1 }
                    step={ 0.01 }
                    { ...resetFor(
                      "ramp.phase",
                      binding.ramp?.phase,
                      DEFAULT_RAMP.phase
                    ) }
                  />
                  <label className="flex cursor-pointer items-center justify-between gap-2 text-label">
                    <span>Yoyo (ping-pong)</span>
                    <ToggleSwitch
                      inputProps={ register( `${ bindingPath }.ramp.yoyo` ) }
                    />
                  </label>
                </>
              )}

              {category === "sequence" && (
                <>
                  {/* A simple scalable list: each stop is the field's own slider,
                      in the parameter's units. */}
                  <div className="flex flex-col gap-1">
                    {stops.map( (
                      _, i
                    ) => (
                      <div
                        key={ i }
                        className="flex items-center gap-1"
                      >
                        <div className="min-w-0 flex-1">
                          <ControlledSliderInput
                            name={ `${ bindingPath }.sequence.stops.${ i }` }
                            label={ `#${ i + 1 }` }
                            min={ domain.min }
                            max={ domain.max }
                            step={ domain.step }
                          />
                        </div>
                        <button
                          type="button"
                          title="Remove stop"
                          onClick={ () => removeStop( i ) }
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-theme text-label transition-colors hover:bg-hover hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) )}
                    <button
                      type="button"
                      onClick={ addStop }
                      className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-theme px-2 py-1.5 text-label transition-colors hover:bg-hover hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add stop
                    </button>
                  </div>
                  <ControlledSliderInput
                    name={ `${ bindingPath }.sequence.cycles` }
                    label="Cycles"
                    min={ 1 }
                    max={ 9 }
                    step={ 1 }
                    { ...resetFor(
                      "sequence.cycles",
                      binding.sequence?.cycles,
                      1
                    ) }
                  />
                  <ControlledSliderInput
                    name={ `${ bindingPath }.sequence.phase` }
                    label="Phase"
                    min={ 0 }
                    max={ 1 }
                    step={ 0.01 }
                    { ...resetFor(
                      "sequence.phase",
                      binding.sequence?.phase,
                      0
                    ) }
                  />
                  <select
                    value={ binding.sequence?.mode ?? "step" }
                    onChange={ ( e ) => setField(
                      "sequence.mode",
                      e.target.value
                    ) }
                    className="h-8 w-full rounded-md border border-theme bg-background px-2 text-foreground"
                  >
                    {SEQUENCE_MODE_OPTIONS.map( ( option ) => (
                      <option key={ option.value } value={ option.value }>
                        {option.label}
                      </option>
                    ) )}
                  </select>

                  {/* Smooth mode animates between stops: ease each transition,
                      and dwell on a stop for `hold` before moving on. */}
                  {binding.sequence?.mode === "smooth" && (
                    <>
                      <ControlledEasingInput
                        name={ `${ bindingPath }.sequence.easing` }
                        label="Transition"
                        { ...resetFor(
                          "sequence.easing",
                          binding.sequence?.easing,
                          "linear"
                        ) }
                      />
                      <ControlledSliderInput
                        name={ `${ bindingPath }.sequence.hold` }
                        label="Hold"
                        min={ 0 }
                        max={ 0.95 }
                        step={ 0.05 }
                        { ...resetFor(
                          "sequence.hold",
                          binding.sequence?.hold,
                          0
                        ) }
                      />
                    </>
                  )}
                </>
              )}

              {category === "noise" && (
                <>
                  <ControlledSliderInput
                    name={ `${ bindingPath }.noise.speed` }
                    label="Speed"
                    min={ 0.1 }
                    max={ 8 }
                    step={ 0.1 }
                    { ...resetFor(
                      "noise.speed",
                      binding.noise?.speed,
                      DEFAULT_NOISE.speed
                    ) }
                  />
                  <ControlledSliderInput
                    name={ `${ bindingPath }.noise.seed` }
                    label="Seed"
                    min={ 0 }
                    max={ 999 }
                    step={ 1 }
                    { ...resetFor(
                      "noise.seed",
                      binding.noise?.seed,
                      DEFAULT_NOISE.seed
                    ) }
                  />
                </>
              )}

              {category === "random" && (
                <>
                  <ControlledSliderInput
                    name={ `${ bindingPath }.random.steps` }
                    label="Steps"
                    min={ 1 }
                    max={ 16 }
                    step={ 1 }
                    { ...resetFor(
                      "random.steps",
                      binding.random?.steps,
                      DEFAULT_RANDOM.steps
                    ) }
                  />
                  <ControlledSliderInput
                    name={ `${ bindingPath }.random.seed` }
                    label="Seed"
                    min={ 0 }
                    max={ 999 }
                    step={ 1 }
                    { ...resetFor(
                      "random.seed",
                      binding.random?.seed,
                      DEFAULT_RANDOM.seed
                    ) }
                  />
                  <ControlledSliderInput
                    name={ `${ bindingPath }.random.phase` }
                    label="Phase"
                    min={ 0 }
                    max={ 1 }
                    step={ 0.01 }
                    { ...resetFor(
                      "random.phase",
                      binding.random?.phase,
                      DEFAULT_RANDOM.phase
                    ) }
                  />
                </>
              )}

              <ChannelMeter varName={ meterVar } />
            </div>

            {/* Layer — how this binding stacks with the other layers on the same
                parameter (blend mode appears once a second layer exists). */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label">Layer</span>
                <label className="flex cursor-pointer items-center gap-2 text-label">
                  <span>Solo</span>
                  <ToggleSwitch
                    inputProps={ register( `${ bindingPath }.solo` ) }
                  />
                </label>
              </div>
              {layers.length > 1 && (
                <select
                  value={ binding.blend ?? "replace" }
                  onChange={ ( e ) => setField(
                    "blend",
                    e.target.value
                  ) }
                  className="h-8 w-full rounded-md border border-theme bg-background px-2 text-foreground"
                >
                  {BLEND_OPTIONS.map( ( option ) => (
                    <option key={ option.value } value={ option.value }>
                      {option.label}
                    </option>
                  ) )}
                </select>
              )}
              <ControlledSliderInput
                name={ `${ bindingPath }.weight` }
                label="Weight"
                min={ 0 }
                max={ 1 }
                step={ 0.05 }
                { ...resetFor(
                  "weight",
                  binding.weight,
                  DEFAULT_WEIGHT
                ) }
              />
            </div>

            {/* Mapping range — real sliders over the parameter's own domain */}
            {kind === "continuous" ? (
              <div className="flex flex-col gap-1">
                <ControlledSliderInput
                  name={ `${ bindingPath }.mapping.min` }
                  label="Min"
                  min={ domain.min }
                  max={ domain.max }
                  step={ domain.step }
                  { ...resetFor(
                    "mapping.min",
                    binding.mapping?.min,
                    domain.min
                  ) }
                />
                <ControlledSliderInput
                  name={ `${ bindingPath }.mapping.max` }
                  label="Max"
                  min={ domain.min }
                  max={ domain.max }
                  step={ domain.step }
                  { ...resetFor(
                    "mapping.max",
                    binding.mapping?.max,
                    domain.max
                  ) }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <ControlledSliderInput
                  name={ `${ bindingPath }.mapping.x.min` }
                  label="X min"
                  min={ domain.min }
                  max={ domain.max }
                  step={ domain.step }
                  { ...resetFor(
                    "mapping.x.min",
                    binding.mapping?.x?.min,
                    domain.min
                  ) }
                />
                <ControlledSliderInput
                  name={ `${ bindingPath }.mapping.x.max` }
                  label="X max"
                  min={ domain.min }
                  max={ domain.max }
                  step={ domain.step }
                  { ...resetFor(
                    "mapping.x.max",
                    binding.mapping?.x?.max,
                    domain.max
                  ) }
                />
                <ControlledSliderInput
                  name={ `${ bindingPath }.mapping.y.min` }
                  label="Y min"
                  min={ domain.min }
                  max={ domain.max }
                  step={ domain.step }
                  { ...resetFor(
                    "mapping.y.min",
                    binding.mapping?.y?.min,
                    domain.min
                  ) }
                />
                <ControlledSliderInput
                  name={ `${ bindingPath }.mapping.y.max` }
                  label="Y max"
                  min={ domain.min }
                  max={ domain.max }
                  step={ domain.step }
                  { ...resetFor(
                    "mapping.y.max",
                    binding.mapping?.y?.max,
                    domain.max
                  ) }
                />
              </div>
            )}

            {/* Easing + invert (continuous only) — same easing control as the
                rest of the form */}
            {kind === "continuous" && (
              <>
                <ControlledEasingInput
                  name={ `${ bindingPath }.mapping.curve` }
                  label="Easing"
                  { ...resetFor(
                    "mapping.curve",
                    binding.mapping?.curve,
                    "linear"
                  ) }
                />
                <label className="flex cursor-pointer items-center justify-between gap-2 text-label">
                  <span>Invert</span>
                  <ToggleSwitch
                    inputProps={ register( `${ bindingPath }.mapping.invert` ) }
                  />
                </label>
              </>
            )}

            {/* Smoothing */}
            <ControlledSliderInput
              name={ `${ bindingPath }.smoothing` }
              label="Smoothing"
              min={ 0 }
              max={ 0.95 }
              step={ 0.05 }
              { ...resetFor(
                "smoothing",
                binding.smoothing,
                kind === "vector2d" ? 0.15 : 0.2
              ) }
            />

            <button
              type="button"
              onClick={ () => {
                // Removing the last layer unbinds the field — close first so
                // Headless UI tears the panel down cleanly. Otherwise keep the
                // popover open on the next layer.
                if ( layers.length <= 1 ) {
                  close();
                }
                removeLayer();
              } }
              className="flex items-center justify-center gap-1.5 rounded-md border border-theme px-2 py-1.5 text-label transition-colors hover:bg-hover hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {layers.length > 1 ? "Remove layer" : "Remove binding"}
            </button>
          </div>
        ) : (
          <></>
        ) )}
      </PopoverPanel>
    </Popover>
  );
}
