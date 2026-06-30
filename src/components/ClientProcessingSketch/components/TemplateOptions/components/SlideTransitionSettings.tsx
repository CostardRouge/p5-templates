"use client";

import React, {
  Fragment, useState
} from "react";
import {
  ChevronDown
} from "lucide-react";
import {
  useController, useFormContext, useWatch
} from "react-hook-form";
import {
  SketchOptionInput,
  SlideTitleSchema,
  SlideTransitionSchema,
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
  BarLabelSegment
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
  const checked = Boolean( field.value );

  return (
    <label className={ `${ CONTROL_BAR_CLASS } cursor-pointer select-none` }>
      <BarLabelSegment label={ label } />
      <span className="flex min-w-0 flex-1 items-center justify-end px-2.5">
        <span className="relative inline-flex shrink-0 items-center">
          <input
            type="checkbox"
            checked={ checked }
            aria-label={ label }
            onChange={ ( e ) => field.onChange( e.target.checked ) }
            onBlur={ field.onBlur }
            className="peer sr-only"
          />
          <span className="h-5 w-9 md:h-4 md:w-7 rounded-full border border-theme bg-foreground/10 transition-colors peer-checked:bg-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus/50" />
          <span className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 md:h-3 md:w-3 -translate-y-1/2 rounded-full border border-theme bg-background shadow transition-transform peer-checked:translate-x-4 md:peer-checked:translate-x-3" />
        </span>
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

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment label={ label } />
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
              <ControlledSliderInput
                name={ `${ titleBase }.numberStart` }
                label="Start at"
                min={ 0 }
                max={ 99 }
                step={ 1 }
              />
              <ControlledSliderInput
                name={ `${ titleBase }.numberPadding` }
                label="Pad"
                min={ 0 }
                max={ 6 }
                step={ 1 }
              />
            </Fragment>
          )}

          {mode === "id" && (
            <ControlledSliderInput
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
              placeholder="variante"
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

          <ControlledSliderInput
            name={ `${ titleBase }.size` }
            label="Size"
            min={ 6 }
            max={ 200 }
            step={ 1 }
          />

          <ControlledColorInput name={ `${ titleBase }.fill` } label="Fill" />

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
            <ControlledEasingInput
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

          {style === "morph" ? (
            <Fragment>
              <ControlledSliderInput
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
              <ControlledColorInput
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
        </div>
      )}
    </div>
  );
}
