"use client";

import {
  useState
} from "react";
import {
  ChevronDown, PaintBucket
} from "lucide-react";
import clsx from "clsx";
import {
  useFormContext, useWatch
} from "react-hook-form";
import type {
  BackgroundConfig, FieldConfig
} from "../../constants/field-config";
import {
  CONTROL_BAR_CLASS,
  CONTROL_CHEVRON_CLASS
} from "../../constants/control-bar";
import {
  BarLabelSegment
} from "../ControlChrome";
import CollapsibleItem from "@/components/CollapsibleItem";
import {
  resolveRelativePath
} from "../../../../utils/resolveRelativePath";
import {
  backgroundFromColor,
  isBackgroundObject,
  normalizeBackground
} from "@/p5/utils/backgroundSpec.js";
import {
  HOUSE_PALETTE_IDS,
  PALETTES
} from "@/p5/utils/palettes.js";
import {
  backgroundSwatch
} from "./backgroundSwatch";

type Rgba = number[];

type Props = {
  name: string;
  config: BackgroundConfig;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
  /** FieldRenderer for a sub-field of this value, passed in to keep the
   *  sub-controls (and their bindings) the studio's own. */
  renderField: ( fieldName: string, config: FieldConfig ) => React.ReactNode;
};

const KINDS = [
  {
    value: "solid",
    label: "Solid"
  },
  {
    value: "linear",
    label: "Linear"
  },
  {
    value: "radial",
    label: "Radial"
  }
] as const;

const MOTION_FIELD: FieldConfig = {
  component: "select",
  label: "Motion",
  options: [
    {
      value: "none",
      label: "None"
    },
    {
      value: "rotate",
      label: "Rotate"
    },
    {
      value: "drift",
      label: "Drift"
    },
    {
      value: "breathe",
      label: "Breathe"
    }
  ]
};

const MOTION_WORDS: Record<string, string> = {
  rotate: "rotates",
  drift: "drifts",
  breathe: "breathes"
};

function Segmented<T extends string>( {
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: readonly { value: T;
    label: string }[];
  value: T;
  onChange: ( value: T ) => void;
} ) {
  return (
    <div
      role="radiogroup"
      aria-label={ label }
      className="grid gap-1"
      style={ {
        gridTemplateColumns: `repeat(${ options.length }, minmax(0, 1fr))`
      } }
    >
      {options.map( ( option ) => {
        const selected = option.value === value;

        return (
          <button
            key={ option.value }
            type="button"
            role="radio"
            aria-checked={ selected }
            onClick={ () => onChange( option.value ) }
            className={ clsx(
              "h-10 md:h-7 min-w-0 truncate whitespace-nowrap rounded-lg border px-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus",
              selected
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "border-theme text-label hover:bg-hover hover:text-foreground"
            ) }
          >
            {option.label}
          </button>
        );
      } )}
    </div>
  );
}

/**
 * The background control: shut, one bar — what it paints, then the kind, the
 * angle and the motion in words; open, the kind, the colours (or the palette's
 * paper), the geometry, the strength, the easing and the motion. Every number
 * below the kind is a sub-field rendered by the studio's own FieldRenderer on
 * a path inside the value (`backgroundColor.angle`…), so each can be bound to
 * a knob, an LFO or the audio and gets the driven look every slider has.
 *
 * The value stays the colour array it was saved as until the kind changes;
 * only then does it become an object (backgroundSpec.js), its second colour
 * derived from the first.
 */
export default function ControlledBackgroundInput( {
  name,
  config,
  label,
  isModified = false,
  onReset,
  renderField
}: Props ) {
  const {
    control, setValue
  } = useFormContext();
  const [
    open,
    setOpen
  ] = useState( false );

  const palettePath = config.palette ? resolveRelativePath(
    name,
    config.palette
  ) : null;
  const [
    value,
    palette
  ] = useWatch( {
    control,
    name: [
      name,
      palettePath ?? name
    ]
  } ) as [ unknown, unknown ];

  const isObject = isBackgroundObject( value );
  const spec = normalizeBackground( value );
  const kind = isObject ? spec.kind : "solid";
  const paletteId = palettePath && typeof palette === "string" ? palette : null;
  const preset = paletteId && ( config.presetsOnly || !HOUSE_PALETTE_IDS.includes( paletteId ) )
    ? ( PALETTES as Record<string, { label?: string;
      paper?: { top: Rgba;
        bottom?: Rgba } }> )[ paletteId ]
    : null;
  const fromKey = config.colors?.from ?? "from";
  const toKey = config.colors?.to ?? "to";
  const fromPalette = isObject && spec.source === "palette";
  const paper = fromPalette ? preset?.paper ?? null : null;

  const write = ( next: unknown ) => setValue(
    name,
    next,
    {
      shouldDirty: true,
      shouldTouch: true
    }
  );

  const setKind = ( next: string ) => {
    if ( isObject ) {
      write( {
        ...( value as object ),
        kind: next
      } );
    } else if ( next !== "solid" ) {
      write( backgroundFromColor(
        value as Rgba ?? [
          0,
          0,
          0
        ],
        next
      ) );
    }
  };

  const setSource = ( next: string ) => write( {
    ...( value as object ),
    source: next
  } );

  const summary = [
    KINDS.find( ( entry ) => entry.value === kind )?.label,
    kind === "linear" ? `${ Math.round( spec.angle ) }°` : null,
    kind === "radial" ? `${ Math.round( spec.center.x * 100 ) }%, ${ Math.round( spec.center.y * 100 ) }%` : null,
    kind !== "solid" && spec.motion !== "none" && spec.cycles !== 0 ? MOTION_WORDS[ spec.motion ] : null,
    fromPalette ? "paper" : null
  ].filter( Boolean ).join( " · " );

  const swatch = backgroundSwatch(
    isObject ? spec : value,
    paper
  );

  return (
    <CollapsibleItem
      expanded={ open }
      onToggle={ setOpen }
      headerContainerClassName="rounded-lg"
      header={ () => (
        <div className={ clsx(
          CONTROL_BAR_CLASS,
          "relative cursor-pointer hover:bg-hover"
        ) }>
          <BarLabelSegment
            label={ label }
            icon={ <PaintBucket className="h-4 w-4 md:h-3 md:w-3 shrink-0 text-label" /> }
            isModified={ isModified }
            onReset={ onReset }
          />
          <span className="relative flex h-full min-w-0 flex-1 items-center gap-2 px-2.5">
            <span
              aria-hidden
              className="h-4 w-10 shrink-0 rounded-md border border-theme md:h-3.5"
              style={ {
                background: swatch
              } }
            />
            <span className="min-w-0 flex-1 truncate">{summary}</span>
            <ChevronDown
              className={ clsx(
                CONTROL_CHEVRON_CLASS,
                "transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180"
              ) }
            />
          </span>
        </div>
      ) }
    >
      {/* Spacing inside the content, never on CollapsibleItem's wrapper: it
          would survive the 0fr collapse (see the palette picker). */}
      <div className="flex flex-col gap-1.5 pb-2 pt-2">
        <Segmented
          label="Background kind"
          options={ KINDS }
          value={ kind }
          onChange={ setKind }
        />

        {isObject && palettePath && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-label">Colours</span>
            <div className="min-w-0 max-w-56 flex-1">
              <Segmented
                label="Colours come from"
                options={ [
                  {
                    value: "own",
                    label: "Own"
                  },
                  {
                    value: "palette",
                    label: "Palette paper"
                  }
                ] as const }
                value={ fromPalette ? "palette" : "own" }
                onChange={ setSource }
              />
            </div>
          </div>
        )}

        {fromPalette && (
          <p className="text-[11px] leading-4 text-label">
            {paper
              ? `The paper of ${ preset?.label ?? paletteId } — top and bottom — follows the palette as it changes.`
              // Every id of a presets-only palette has a paper but the custom
              // look, whose colours are the ones below.
              : config.presetsOnly
                ? "The custom look has no paper: the colours below paint until a palette is picked."
                : "The palette in use has no paper (the sketch's own colours do not carry one): its own colours paint for now."}
          </p>
        )}

        {isObject ? (
          <div
            inert={ fromPalette && !!paper }
            aria-disabled={ fromPalette && !!paper }
            className={ clsx(
              "flex flex-col gap-1.5",
              fromPalette && paper && "opacity-40 grayscale"
            ) }
          >
            {renderField(
              fromKey,
              {
                component: "color",
                label: kind === "solid" ? "Colour" : "From"
              }
            )}
            {kind !== "solid" && renderField(
              toKey,
              {
                component: "color",
                label: "To"
              }
            )}
          </div>
        ) : renderField(
          "",
          {
            component: "color",
            label: "Colour"
          }
        )}

        {kind === "linear" && renderField(
          "angle",
          {
            component: "slider",
            label: "Angle",
            min: 0,
            max: 360,
            step: 1
          }
        )}

        {kind === "radial" && (
          <>
            {renderField(
              "center",
              {
                component: "vector2d",
                label: "Centre",
                allowNegative: false,
                min: 0,
                max: 1,
                step: 0.01,
                yDown: true
              }
            )}
            {renderField(
              "radius",
              {
                component: "slider",
                label: "Radius",
                min: 0.1,
                max: 2,
                step: 0.01
              }
            )}
          </>
        )}

        {kind !== "solid" && (
          <>
            {renderField(
              "strength",
              {
                component: "slider",
                label: "Strength",
                min: 0,
                max: 1,
                step: 0.01
              }
            )}
            {renderField(
              "easing",
              {
                component: "easing",
                label: "Easing"
              }
            )}
            {renderField(
              "motion",
              MOTION_FIELD
            )}
            {spec.motion !== "none" && renderField(
              "cycles",
              {
                component: "slider",
                label: "Cycles per loop",
                min: -4,
                max: 4,
                step: 1
              }
            )}
          </>
        )}
      </div>
    </CollapsibleItem>
  );
}
