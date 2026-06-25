"use client";

import React from "react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import {
  Activity, Plus, Trash2, X
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
  type Binding,
  type BindingKind,
  type SourceCategory,
  channelSourceOptions,
  decodeSource,
  defaultSequence,
  DEFAULT_OSCILLATOR,
  DEFAULT_RAMP,
  encodeSource,
  getSketchScope,
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
 * Bindings are stored as data at `<scope>.bindings` (an array on the sketch
 * settings), resolved at read time by the options proxy. The mapping-range and
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
    setValue, register
  } = useFormContext();

  const scope = getSketchScope( fieldPath );
  const target = toSketchRelativePath( fieldPath );
  const bindingsPath = scope ? `${ scope }.bindings` : "";

  const bindings = useWatch( {
    name: bindingsPath || "__no_bindings__"
  } ) as Binding[] | undefined;

  // Not a sketch parameter → no affordance.
  if ( !scope || !target ) {
    return null;
  }

  const kind: BindingKind = component === "vector2d" ? "vector2d" : "continuous";
  const list: Binding[] = Array.isArray( bindings ) ? bindings : [];
  const index = list.findIndex( ( b ) => b && b.target === target );
  const binding = index >= 0 ? list[ index ] : undefined;
  const bound = !!binding;
  const sourceOptions = channelSourceOptions( kind );
  const domain = fieldDomain( config );

  // Path of the binding object in the form; sub-fields (mapping.min, smoothing,
  // enabled…) are edited in place so they round-trip like any other control.
  const bindingPath = `${ bindingsPath }.${ index }`;

  const writeBindings = ( next: Binding[] ) => {
    setValue(
      bindingsPath,
      next,
      {
        shouldDirty: true
      }
    );
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

  const createBinding = () => {
    writeBindings( [
      ...list,
      makeDefaultBinding(
        target,
        kind,
        sourceOptions[ 0 ],
        config
      )
    ] );
  };

  const removeBinding = () => {
    writeBindings( list.filter( ( b ) => b.target !== target ) );
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
          // First click on an unbound field creates the binding AND opens the
          // popover (no preventDefault) so it can be configured immediately.
          if ( !bound ) {
            createBinding();
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
              <span className="font-medium text-foreground">Modulation</span>
              <label className="flex cursor-pointer items-center gap-2 text-label">
                <span>Enabled</span>
                <ToggleSwitch
                  inputProps={ register( `${ bindingPath }.enabled` ) }
                />
              </label>
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
                  } }
                  className="h-8 w-full rounded-md border border-theme bg-background px-2 text-foreground"
                >
                  {sourceOptions.map( ( option ) => (
                    <option key={ option.value } value={ option.value }>
                      {option.label}
                    </option>
                  ) )}
                </select>
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
                </>
              )}

              <ChannelMeter varName={ meterVar } />
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
                // Close first so Headless UI tears the panel down cleanly,
                // then drop the binding from the array.
                close();
                removeBinding();
              } }
              className="flex items-center justify-center gap-1.5 rounded-md border border-theme px-2 py-1.5 text-label transition-colors hover:bg-hover hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove binding
            </button>
          </div>
        ) : (
          <></>
        ) )}
      </PopoverPanel>
    </Popover>
  );
}
