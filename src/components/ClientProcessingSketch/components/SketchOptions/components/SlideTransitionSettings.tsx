"use client";

import React, {
  Fragment, useEffect, useRef, useState
} from "react";
import {
  ChevronDown
} from "lucide-react";
import {
  useController, useFormContext, useWatch
} from "react-hook-form";
import deepClone from "@/utils/deepClone";
import {
  SketchOptionInput,
  SlideTitleSchema,
  SlideTransitionSchema,
  SlideTransitionSoundRepeatSchema,
  SlideTransitionSoundSchema,
  SPECS_SOUND_PRESETS,
  TITLE_ALIGNMENTS,
  TITLE_CHANGE_ANIMATIONS,
  TITLE_DISPLAY_STYLES,
  TITLE_MODES,
  TRANSITION_LOOP_MODES,
  TRANSITION_SOURCE_MODES,
  TRANSITION_STYLES
} from "@/types/sketch.types";
import ControlledEasingInput from "./ContentItems/components/ControlledEasingInput/ControlledEasingInput";
import ControlledSliderInput from "./ContentItems/components/ControlledSliderInput/ControlledSliderInput";
import ControlledColorInput from "./ContentItems/components/ControlledColorInput/ControlledColorInput";
import ControlledSlideMultiSelect from "./ContentItems/components/ControlledSlideMultiSelect/ControlledSlideMultiSelect";
import ControlledVector2DInput from "./ContentItems/components/ControlledVector2DInput/ControlledVector2DInput";
import {
  BarLabelSegment, ToggleSwitch
} from "./ContentItems/components/ControlChrome";
import {
  fontSelectOptions
} from "./ContentItems/constants/field-config";
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

const STYLE_LABELS: Record<( typeof TRANSITION_STYLES )[ number ], string> = {
  morph: "Morph (interpolate)",
  dip: "Dip (fade + snap)"
};

const TITLE_MODE_LABELS: Record<( typeof TITLE_MODES )[ number ], string> = {
  name: "Slide name",
  alphabet: "Alphabet (A, B, C…)",
  number: "Number (1, 2, 3…)",
  id: "Short id"
};

const TITLE_DISPLAY_STYLE_LABELS: Record<( typeof TITLE_DISPLAY_STYLES )[ number ], string> = {
  plain: "Plain",
  bracket: "Bracket [ ]",
  pill: "Pill",
  underline: "Underline"
};

const TITLE_CHANGE_LABELS: Record<( typeof TITLE_CHANGE_ANIMATIONS )[ number ], string> = {
  none: "None (cut)",
  fade: "Fade",
  rise: "Rise",
  scale: "Scale",
  roll: "Roll (odometer)"
};

const TITLE_ALIGN_LABELS: Record<( typeof TITLE_ALIGNMENTS )[ number ], string> = {
  left: "Left",
  center: "Center",
  right: "Right"
};

const SOUND_PRESET_LABELS: Record<( typeof SPECS_SOUND_PRESETS )[ number ], string> = {
  click: "Click",
  tick: "Tick",
  blip: "Blip",
  pop: "Pop",
  beep: "Beep",
  wood: "Woodblock",
  typewriter: "Typewriter"
};

const SOUND_REPEAT_LABELS: Record<"once" | "count", string> = {
  once: "Once per change",
  count: "Burst (N hits)"
};

/**
 * Reset affordance for a single field, mirroring the one in FieldRenderer:
 * the value the field was loaded with is captured once on mount, `isModified`
 * compares the live value against it, and `handleReset` restores it. Lets the
 * bespoke montage/title controls offer the same "reset to saved value" button
 * the regular form controls have.
 */
function useFieldReset( name: string ) {
  const {
    control, setValue, getValues
  } = useFormContext();

  const currentValue = useWatch( {
    control,
    name
  } );

  const initialRef = useRef<unknown>( undefined );
  const initializedRef = useRef( false );

  if ( !initializedRef.current ) {
    initializedRef.current = true;
    initialRef.current = deepClone( getValues( name ) );
  }

  const isModified =
    JSON.stringify( currentValue ) !== JSON.stringify( initialRef.current );

  const handleReset = ( event: React.MouseEvent ) => {
    event.preventDefault();
    event.stopPropagation();
    setValue(
      name,
      deepClone( initialRef.current ),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true
      }
    );
  };

  return {
    isModified,
    handleReset
  };
}

/**
 * Thin wrappers that give the shared slider / color / easing controls the same
 * mount-baseline reset the bar controls get, without threading the props
 * through every call site.
 */
function ResettableSlider( props: React.ComponentProps<typeof ControlledSliderInput> ) {
  const {
    isModified, handleReset
  } = useFieldReset( props.name );

  return (
    <ControlledSliderInput
      { ...props }
      isModified={ isModified }
      onReset={ handleReset }
    />
  );
}

function ResettableColor( props: React.ComponentProps<typeof ControlledColorInput> ) {
  const {
    isModified, handleReset
  } = useFieldReset( props.name );

  return (
    <ControlledColorInput
      { ...props }
      isModified={ isModified }
      onReset={ handleReset }
    />
  );
}

function ResettableEasing( props: React.ComponentProps<typeof ControlledEasingInput> ) {
  const {
    isModified, handleReset
  } = useFieldReset( props.name );

  return (
    <ControlledEasingInput
      { ...props }
      isModified={ isModified }
      onReset={ handleReset }
    />
  );
}

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
  const {
    isModified, handleReset
  } = useFieldReset( name );
  const current = typeof field.value === "string" ? field.value : options[ 0 ]?.value;
  const display = options.find( ( option ) => option.value === current )?.label ?? current;

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment
        label={ label }
        isModified={ isModified }
        onReset={ handleReset }
      />

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
  const {
    isModified, handleReset
  } = useFieldReset( name );
  const joined = Array.isArray( field.value ) ? field.value.join( ", " ) : "";
  const [
    text,
    setText
  ] = useState( joined );

  // Resync the visible text when the field value changes from the outside (a
  // reset): only when it no longer matches what the current text parses to, so
  // mid-typing punctuation (a trailing comma) is preserved.
  useEffect(
    () => {
      const fromText = text
        .split( "," )
        .map( ( key ) => key.trim() )
        .filter( ( key ) => key.length > 0 )
        .join( ", " );

      if ( joined !== fromText ) {
        setText( joined );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      joined
    ]
  );

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment
        label="Snap"
        isModified={ isModified }
        onReset={ handleReset }
      />
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

/** One-line labelled switch sharing the control-bar chrome. */
function BarToggle( {
  name,
  label
}: {
  name: string;
  label: string;
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
  const {
    isModified, handleReset
  } = useFieldReset( name );
  const checked = Boolean( field.value );

  return (
    <label className={ `${ CONTROL_BAR_CLASS } cursor-pointer select-none` }>
      <BarLabelSegment
        label={ label }
        isModified={ isModified }
        onReset={ handleReset }
      />
      <span className="flex min-w-0 flex-1 items-center justify-end px-2.5">
        <ToggleSwitch
          inputProps={ {
            checked,
            "aria-label": label,
            onChange: ( e ) => field.onChange( e.target.checked ),
            onBlur: field.onBlur
          } }
        />
      </span>
    </label>
  );
}

/** One-line free-text input sharing the control-bar chrome. */
function BarText( {
  name,
  label,
  placeholder
}: {
  name: string;
  label: string;
  placeholder?: string;
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
  const {
    isModified, handleReset
  } = useFieldReset( name );

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment
        label={ label }
        isModified={ isModified }
        onReset={ handleReset }
      />
      <input
        type="text"
        value={ typeof field.value === "string" ? field.value : "" }
        placeholder={ placeholder }
        aria-label={ label }
        className={ CONTROL_BAR_INPUT_CLASS }
        onChange={ ( e ) => field.onChange( e.target.value ) }
        onBlur={ field.onBlur }
      />
    </div>
  );
}

/**
 * "Slide title" sub-panel of the montage controls: overlay that names the
 * variant currently on screen. Mode-specific options are revealed with
 * conditional groups, mirroring the morph/dip split above.
 */
function SlideTitleControls( {
  base
}: {
  base: string;
} ) {
  // Untyped (like the bar helpers above): the title field paths are built from
  // a runtime string, so the strict SketchOptionInput field-path type can't
  // narrow them.
  const {
    control, setValue
  } = useFormContext();
  const titleBase = `${ base }.title`;

  const title = useWatch( {
    control,
    name: titleBase
  } ) as Record<string, unknown> | undefined;

  const enabled = Boolean( title?.enabled );
  const mode = ( title?.mode as string ) ?? "name";
  const showPrefix = Boolean( title?.showPrefix );
  const changeAnimation = ( title?.changeAnimation as string ) ?? "fade";

  const handleToggle = ( on: boolean ) => {
    if ( on ) {
      setValue(
        titleBase,
        SlideTitleSchema.parse( {
          ...( title ?? {} ),
          enabled: true
        } ),
        {
          shouldDirty: true
        }
      );
    } else {
      setValue(
        `${ titleBase }.enabled`,
        false,
        {
          shouldDirty: true
        }
      );
    }
  };

  return (
    <div className="mt-1 rounded-lg border border-theme bg-foreground/[0.03] p-1">
      <label className="flex cursor-pointer items-center justify-between gap-2 px-1 py-1.5 md:py-1 select-none text-foreground">
        <span className="truncate">Slide title</span>
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
            name={ `${ titleBase }.mode` }
            label="Numbering"
            options={ TITLE_MODES.map( ( value ) => ( {
              value,
              label: TITLE_MODE_LABELS[ value ]
            } ) ) }
          />

          {/* Mode-specific conditional groups. */}
          {( mode === "name" || mode === "alphabet" ) && (
            <BarToggle name={ `${ titleBase }.uppercase` } label="Uppercase" />
          )}

          {mode === "number" && (
            <Fragment>
              <ResettableSlider
                name={ `${ titleBase }.numberStart` }
                label="Start at"
                min={ 0 }
                max={ 99 }
                step={ 1 }
              />
              <ResettableSlider
                name={ `${ titleBase }.numberPadding` }
                label="Pad"
                min={ 0 }
                max={ 6 }
                step={ 1 }
              />
            </Fragment>
          )}

          {mode === "id" && (
            <ResettableSlider
              name={ `${ titleBase }.idLength` }
              label="Id length"
              min={ 2 }
              max={ 36 }
              step={ 1 }
            />
          )}

          <BarToggle name={ `${ titleBase }.showPrefix` } label="Prefix" />

          {showPrefix && (
            <BarText
              name={ `${ titleBase }.prefix` }
              label="Prefix text"
              placeholder="VARIANT"
            />
          )}

          {/* Screen-space position: constrained to [0,1] (matching the Vec2
              schema, so the pad can never persist an out-of-range value) with
              yDown so the top of the pad maps to the top of the canvas. */}
          <ControlledVector2DInput
            name={ `${ titleBase }.position` }
            config={ {
              allowNegative: false,
              min: 0,
              max: 1,
              step: 0.01,
              yDown: true
            } }
          />

          <BarSelect
            name={ `${ titleBase }.align` }
            label="Align"
            options={ TITLE_ALIGNMENTS.map( ( value ) => ( {
              value,
              label: TITLE_ALIGN_LABELS[ value ]
            } ) ) }
          />

          <BarSelect
            name={ `${ titleBase }.font` }
            label="Font"
            options={ fontSelectOptions.map( ( option ) => ( {
              value: String( option.value ),
              label: option.label
            } ) ) }
          />

          <ResettableSlider
            name={ `${ titleBase }.size` }
            label="Size"
            min={ 6 }
            max={ 200 }
            step={ 1 }
          />

          <ResettableColor name={ `${ titleBase }.fill` } label="Fill" />

          <BarSelect
            name={ `${ titleBase }.style` }
            label="Style"
            options={ TITLE_DISPLAY_STYLES.map( ( value ) => ( {
              value,
              label: TITLE_DISPLAY_STYLE_LABELS[ value ]
            } ) ) }
          />

          <BarSelect
            name={ `${ titleBase }.changeAnimation` }
            label="On change"
            options={ TITLE_CHANGE_ANIMATIONS.map( ( value ) => ( {
              value,
              label: TITLE_CHANGE_LABELS[ value ]
            } ) ) }
          />

          {changeAnimation !== "none" && (
            <ResettableEasing
              name={ `${ titleBase }.changeEasing` }
              label="Change easing"
            />
          )}

          <p className="px-1 pt-0.5 text-[0.65rem] leading-snug text-label">
            Names the variant currently on screen and animates between labels as
            the montage cycles. Defaults mirror the specs overlay.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * "Transition sound" sub-panel of the montage controls: a hit played through
 * the sketch audio engine each time the montage advances to the next variant
 * (the audible counterpart of the dip / title switch). Because it routes
 * through the audio engine, it is baked into recordings too. The repeat "count"
 * mode reveals its burst controls, mirroring the mode-specific reveals above.
 */
function SlideTransitionSoundControls( {
  base
}: {
  base: string;
} ) {
  // Untyped like SlideTitleControls: the sound field paths are built from a
  // runtime string the strict SketchOptionInput field-path type can't narrow.
  const {
    control, setValue
  } = useFormContext();
  const soundBase = `${ base }.sound`;

  const sound = useWatch( {
    control,
    name: soundBase
  } ) as Record<string, unknown> | undefined;

  const enabled = Boolean( sound?.enabled );
  const repeat = sound?.repeat as Record<string, unknown> | undefined;
  const repeatMode = ( repeat?.mode as string ) ?? "once";

  const handleToggle = ( on: boolean ) => {
    if ( on ) {
      setValue(
        soundBase,
        SlideTransitionSoundSchema.parse( {
          ...( sound ?? {} ),
          enabled: true
        } ),
        {
          shouldDirty: true
        }
      );
    } else {
      setValue(
        `${ soundBase }.enabled`,
        false,
        {
          shouldDirty: true
        }
      );
    }
  };

  const handleRepeatMode = ( mode: string ) => {
    // Reparse the whole repeat group so switching modes fills that mode's
    // defaults (the discriminated union has different fields per mode).
    setValue(
      `${ soundBase }.repeat`,
      SlideTransitionSoundRepeatSchema.parse( {
        mode
      } ),
      {
        shouldDirty: true
      }
    );
  };

  return (
    <div className="mt-1 rounded-lg border border-theme bg-foreground/[0.03] p-1">
      <label className="flex cursor-pointer items-center justify-between gap-2 px-1 py-1.5 md:py-1 select-none text-foreground">
        <span className="truncate">Transition sound</span>
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
            name={ `${ soundBase }.preset` }
            label="Sound"
            options={ SPECS_SOUND_PRESETS.map( ( value ) => ( {
              value,
              label: SOUND_PRESET_LABELS[ value ]
            } ) ) }
          />

          <ResettableSlider
            name={ `${ soundBase }.volume` }
            label="Volume"
            min={ 0 }
            max={ 1 }
            step={ 0.05 }
          />

          <ResettableSlider
            name={ `${ soundBase }.pitch` }
            label="Pitch (×)"
            min={ 0.25 }
            max={ 4 }
            step={ 0.05 }
          />

          <ResettableSlider
            name={ `${ soundBase }.pitchVariation` }
            label="Humanize"
            min={ 0 }
            max={ 1 }
            step={ 0.05 }
          />

          <ResettableSlider
            name={ `${ soundBase }.slidePitchSpread` }
            label="Pitch by slide (oct)"
            min={ -2 }
            max={ 2 }
            step={ 0.05 }
          />

          {/* Reparses the whole repeat group on change so "count" fills its
              own defaults (times / interval / pitchStep) — BarSelect would set
              only the mode string and leave the burst sliders unbound. */}
          <div className={ CONTROL_BAR_CLASS }>
            <span className="flex shrink-0 items-center px-2.5 text-label">
              Repeat
            </span>
            <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
              <span className="truncate">{SOUND_REPEAT_LABELS[ repeatMode as "once" | "count" ] ?? repeatMode}</span>
              <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
            </span>
            <select
              aria-label="Repeat"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={ repeatMode }
              onChange={ ( e ) => handleRepeatMode( e.target.value ) }
            >
              {(
                [
                  "once",
                  "count"
                ] as const
              ).map( ( value ) => (
                <option key={ value } value={ value }>
                  {SOUND_REPEAT_LABELS[ value ]}
                </option>
              ) )}
            </select>
          </div>

          {repeatMode === "count" && (
            <Fragment>
              <ResettableSlider
                name={ `${ soundBase }.repeat.times` }
                label="Hits"
                min={ 2 }
                max={ 16 }
                step={ 1 }
              />
              <ResettableSlider
                name={ `${ soundBase }.repeat.interval` }
                label="Interval (s)"
                min={ 0.02 }
                max={ 2 }
                step={ 0.01 }
              />
              <ResettableSlider
                name={ `${ soundBase }.repeat.pitchStep` }
                label="Pitch ramp (oct/hit)"
                min={ -0.5 }
                max={ 0.5 }
                step={ 0.01 }
              />
            </Fragment>
          )}

          <p className="px-1 pt-0.5 text-[0.65rem] leading-snug text-label">
            Plays a hit at each variant change — the audible counterpart of the
            dip / title switch. Routes through the sketch audio engine, so it is
            baked into recordings. &ldquo;Pitch by slide&rdquo; gives each
            variant its own note.
          </p>
        </div>
      )}
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
 * src/sketches/p5/utils/slides/morph). Specs / HUD overlays on this slide show
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
  const style = ( transition?.style as string ) ?? "morph";

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

          <BarSelect
            name={ `${ base }.style` }
            label="Style"
            options={ TRANSITION_STYLES.map( ( value ) => ( {
              value,
              label: STYLE_LABELS[ value ]
            } ) ) }
          />

          <ResettableEasing name={ `${ base }.easing` } label="Easing" />

          <ResettableSlider
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

          {style === "morph" ? (
            <Fragment>
              <ResettableSlider
                name={ `${ base }.stagger` }
                label="Stagger"
                min={ 0 }
                max={ 0.9 }
                step={ 0.05 }
              />

              <SnapKeysInput name={ `${ base }.snapKeys` } />

              <p className="px-1 pt-0.5 text-[0.65rem] leading-snug text-label">
                Morphs the source slides&apos; parameters over this slide&apos;s
                duration. Numbers &amp; colours interpolate; discrete params
                (seed, modes) should be listed under Snap. Stagger offsets each
                param group so they don&apos;t all move at once.
              </p>
            </Fragment>
          ) : (
            <Fragment>
              <ResettableColor
                name={ `${ base }.dipColor` }
                label="Dip color"
              />

              <p className="px-1 pt-0.5 text-[0.65rem] leading-snug text-label">
                Snaps between source slides, fading through the dip colour at
                each switch. Use for variants too different to interpolate
                (seed, layout).
              </p>
            </Fragment>
          )}

          <SlideTitleControls base={ base } />

          <SlideTransitionSoundControls base={ base } />
        </div>
      )}
    </div>
  );
}
