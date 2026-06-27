"use client";

import React, {
  useState
} from "react";
import {
  ChevronDown
} from "lucide-react";
import {
  useController, useFormContext, useWatch
} from "react-hook-form";
import {
  SketchOptionInput,
  SlideTransitionSchema,
  TRANSITION_LOOP_MODES,
  TRANSITION_SOURCE_MODES
} from "@/types/sketch.types";
import ControlledEasingInput from "./ContentItems/components/ControlledEasingInput/ControlledEasingInput";
import ControlledSliderInput from "./ContentItems/components/ControlledSliderInput/ControlledSliderInput";
import ControlledSlideMultiSelect from "./ContentItems/components/ControlledSlideMultiSelect/ControlledSlideMultiSelect";
import {
  BarLabelSegment
} from "./ContentItems/components/ControlChrome";
import {
  CONTROL_BAR_CLASS,
  CONTROL_BAR_INPUT_CLASS,
  CONTROL_CHEVRON_CLASS
} from "./ContentItems/constants/control-bar";

const SOURCE_LABELS: Record<( typeof TRANSITION_SOURCE_MODES )[ number ], string> = {
  all: "All other slides",
  selected: "Selected slides"
};

const LOOP_LABELS: Record<( typeof TRANSITION_LOOP_MODES )[ number ], string> = {
  cyclic: "Cyclic (loops)",
  pingpong: "Ping-pong",
  once: "Once (hold last)"
};

/** One-line native <select> sharing the control-bar chrome. */
function BarSelect( {
  name,
  label,
  options
}: {
  name: string;
  label: string;
  options: Array<{ value: string;
    label: string }>;
} ) {
  const {
    control
  } = useFormContext();
  const {
    field
  } = useController( {
    name,
    control
  } );
  const current = typeof field.value === "string" ? field.value : options[ 0 ]?.value;
  const display = options.find( ( option ) => option.value === current )?.label ?? current;

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment label={ label } />

      <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
        <span className="truncate">{display}</span>
        <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
      </span>

      <select
        aria-label={ label }
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={ current }
        onChange={ ( e ) => field.onChange( e.target.value ) }
        onBlur={ field.onBlur }
      >
        {options.map( ( option ) => (
          <option key={ option.value } value={ option.value }>
            {option.label}
          </option>
        ) )}
      </select>
    </div>
  );
}

/** Comma-separated text input bound to a string[] of param keys to snap. */
function SnapKeysInput( {
  name
}: {
  name: string;
} ) {
  const {
    control
  } = useFormContext();
  const {
    field
  } = useController( {
    name,
    control
  } );
  const initial = Array.isArray( field.value ) ? field.value.join( ", " ) : "";
  const [
    text,
    setText
  ] = useState( initial );

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment label="Snap" />
      <input
        type="text"
        value={ text }
        placeholder="seed, sites.count"
        aria-label="Parameters to snap"
        className={ CONTROL_BAR_INPUT_CLASS }
        onChange={ ( e ) => {
          setText( e.target.value );
          field.onChange( e.target.value
            .split( "," )
            .map( ( key ) => key.trim() )
            .filter( ( key ) => key.length > 0 ) );
        } }
        onBlur={ field.onBlur }
      />
    </div>
  );
}

type Props = {
  activeIndex: number;
};

/**
 * Per-slide "montage / transition" controls. When enabled, the slide stops
 * showing its own variant and instead morphs the sketch parameters of the
 * selected source slides into one another over its duration (see the runtime in
 * src/templates/p5/utils/slides/morph). Specs / HUD overlays on this slide show
 * the interpolated values automatically.
 */
export default function SlideTransitionSettings( {
  activeIndex
}: Props ) {
  const {
    control, setValue
  } = useFormContext<SketchOptionInput>();
  const base = `slides.${ activeIndex }.transition` as const;

  const transition = useWatch( {
    control,
    name: base
  } ) as Record<string, unknown> | undefined;

  const enabled = Boolean( transition?.enabled );
  const sources = ( transition?.sources as string ) ?? "all";

  const handleToggle = ( on: boolean ) => {
    if ( on ) {
      // Fill all defaults so the sub-controls bind to defined values.
      setValue(
        base,
        SlideTransitionSchema.parse( {
          ...( transition ?? {} ),
          enabled: true
        } ),
        {
          shouldDirty: true
        }
      );
    } else {
      setValue(
        `${ base }.enabled`,
        false,
        {
          shouldDirty: true
        }
      );
    }
  };

  return (
    <div className="mb-1 p-1 border border-theme rounded-lg bg-background text-sm md:text-xs">
      <label className="flex cursor-pointer items-center justify-between gap-2 px-1 py-1.5 md:py-1 select-none text-foreground">
        <span className="truncate">Montage / transition</span>
        <span className="relative inline-flex shrink-0 items-center">
          <input
            type="checkbox"
            checked={ enabled }
            onChange={ ( e ) => handleToggle( e.target.checked ) }
            className="peer sr-only"
          />
          <span className="h-6 w-10 md:h-5 md:w-9 rounded-full border border-theme bg-foreground/10 transition-colors peer-checked:bg-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus/50" />
          <span className="pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 md:h-4 md:w-4 -translate-y-1/2 rounded-full border border-theme bg-background shadow transition-transform peer-checked:translate-x-4" />
        </span>
      </label>

      {enabled && (
        <div className="flex flex-col gap-1 pt-1">
          <BarSelect
            name={ `${ base }.sources` }
            label="Sources"
            options={ TRANSITION_SOURCE_MODES.map( ( mode ) => ( {
              value: mode,
              label: SOURCE_LABELS[ mode ]
            } ) ) }
          />

          {sources === "selected" && (
            <ControlledSlideMultiSelect
              name={ `${ base }.slideIds` }
              activeIndex={ activeIndex }
              label="Slides"
            />
          )}

          <ControlledEasingInput name={ `${ base }.easing` } label="Easing" />

          <ControlledSliderInput
            name={ `${ base }.holdRatio` }
            label="Hold"
            min={ 0 }
            max={ 0.9 }
            step={ 0.05 }
          />

          <BarSelect
            name={ `${ base }.loop` }
            label="Loop"
            options={ TRANSITION_LOOP_MODES.map( ( mode ) => ( {
              value: mode,
              label: LOOP_LABELS[ mode ]
            } ) ) }
          />

          <SnapKeysInput name={ `${ base }.snapKeys` } />

          <p className="px-1 pt-0.5 text-[0.65rem] leading-snug text-label">
            Morphs the source slides&apos; parameters over this slide&apos;s
            duration. Numbers &amp; colours interpolate; discrete params (seed,
            modes) should be listed under Snap.
          </p>
        </div>
      )}
    </div>
  );
}
