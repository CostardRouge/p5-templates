"use client";

import {
  useMemo, useState
} from "react";
import {
  Check, ChevronDown, Copy, Palette
} from "lucide-react";
import clsx from "clsx";
import {
  useFormContext, useWatch
} from "react-hook-form";
import deepClone from "@/utils/deepClone";
import type {
  PaletteOption, PalettePickerConfig
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
  bindingValueVarName
} from "@/lib/channelBridge";
import LiveBindingValue from "../BindingAffordance/LiveBindingValue";
import {
  paperGradient, rampGradient, type Paper, type Rgb
} from "./paletteSwatch";
import {
  resolveRelativePath
} from "../../../../utils/resolveRelativePath";

type Props = {
  name: string;
  config: PalettePickerConfig;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
  // An enum binding driving the field: the palette ids it cycles through, in
  // order, and the target whose published index says which one plays now.
  live?: {
    target: string;
    values: unknown[];
  } | null;
};

type Look = {
  stops?: Rgb[];
  hardness?: number;
  paper?: Paper;
};

/**
 * A palette drawn as what it is: the ramp as a strip, on its own paper. The
 * strip is inset so the paper shows around it — a riso ink set on cream and
 * the same set on graphite are different looks, and the tile has to say so.
 */
function Swatch( {
  look,
  className,
  style
}: {
  look: Look;
  className?: string;
  style?: React.CSSProperties;
} ) {
  const ramp = rampGradient(
    look.stops,
    look.hardness
  );
  const paper = paperGradient( look.paper );

  return (
    <span
      aria-hidden
      className={ clsx(
        "block overflow-hidden rounded-md border border-theme",
        className
      ) }
      style={ {
        ...style,
        background: paper ?? undefined
      } }
    >
      <span
        className="block h-full w-full rounded-[3px]"
        style={ {
          background: ramp ?? undefined
        } }
      />
    </span>
  );
}

// Opacity of cycle slot `index` under the published index `v`: 1 on it, 0 one
// slot away, written `1 - |v - i|` floored at 0 — CSS has max(), not abs()
// everywhere. The select's option lane uses the same expression.
function litAt(
  indexVar: string, index: number
): string {
  return `max(0, 1 - max(${ indexVar } - ${ index }, ${ index } - ${ indexVar }))`;
}

/**
 * The palette chooser: a one-line bar naming the current look and showing its
 * swatch, which unfolds into a grid of swatch tiles grouped by kind. The tiles
 * are native radio inputs (registered on the same field), so the arrow keys
 * walk the grid and a screen reader reads a radio group, for free. When a
 * preset is chosen, "edit a copy" writes its stops, hardness and paper into
 * the form's own fields and switches to the custom look — the way to start
 * from a preset and change one ink.
 *
 * Driven by an enum binding, it shows the palette the SKETCH is on, frame by
 * frame, without a React render: every palette of the cycle is stacked in the
 * bar's swatch and only the published index's is opaque, a lane along the
 * bar's bottom edge lights the same slot, and each tile in the cycle carries
 * its own segment of it — so the grid also says which looks the knob walks.
 */
export default function ControlledPalettePicker( {
  name,
  config,
  label,
  isModified = false,
  onReset,
  live
}: Props ) {
  const {
    control, register, getValues, setValue
  } = useFormContext();
  const [
    open,
    setOpen
  ] = useState( false );

  const customValue = config.custom?.value ?? "custom";
  const paths = useMemo(
    () => ( {
      stops: config.custom?.stops ? resolveRelativePath(
        name,
        config.custom.stops
      ) : null,
      hardness: config.custom?.hardness ? resolveRelativePath(
        name,
        config.custom.hardness
      ) : null,
      paper: config.custom?.paper ? resolveRelativePath(
        name,
        config.custom.paper
      ) : null
    } ),
    [
      name,
      config.custom
    ]
  );

  const current = useWatch( {
    control,
    name
  } ) as string | undefined;
  // The hand-made look, live: watched so the Custom tile and the bar repaint
  // as a stop is edited below. A path that is not configured watches the
  // field itself, which is harmless and keeps the hook count constant.
  const [
    customStops,
    customHardness,
    customPaper
  ] = useWatch( {
    control,
    name: [
      paths.stops ?? name,
      paths.hardness ?? name,
      paths.paper ?? name
    ]
  } ) as [ unknown, unknown, unknown ];

  const customLook: Look = {
    stops: paths.stops && Array.isArray( customStops ) ? customStops as Rgb[] : undefined,
    hardness: paths.hardness && typeof customHardness === "number" ? customHardness : undefined,
    paper: paths.paper && customPaper && typeof customPaper === "object" ? customPaper as Paper : undefined
  };

  const lookOf = ( option: PaletteOption | undefined ): Look => (
    !option || option.value === customValue || !option.stops
      ? customLook
      : {
        stops: option.stops,
        hardness: option.hardness,
        paper: option.paper
      } );

  const selected = config.options.find( ( option ) => option.value === ( current ?? customValue ) );
  const selectedLook = lookOf( selected );

  // Groups in first-seen order; options without one share an untitled group.
  const groups = useMemo(
    () => {
      const map = new Map<string, PaletteOption[]>();

      for ( const option of config.options ) {
        const key = option.group ?? "";

        map.set(
          key,
          [
            ...( map.get( key ) ?? [] ),
            option
          ]
        );
      }

      return [
        ...map.entries()
      ];
    },
    [
      config.options
    ]
  );

  const cycle = live?.values?.length ? live.values : null;
  const optionOf = ( value: unknown ) => config.options.find( ( option ) => option.value === String( value ) );
  const cycleLabels = cycle?.map( ( value ) => optionOf( value )?.label ?? String( value ) );
  const baseIndex = cycle
    ? cycle.findIndex( ( value ) => String( value ) === ( current ?? customValue ) )
    : -1;
  // Before the first frame (or once the binding stops playing) the var is
  // absent and the base palette's slot is the lit one; a base outside the
  // cycle lights none.
  const indexVar = live && cycle
    ? `var(${ bindingValueVarName( live.target ) }, ${ baseIndex >= 0 ? baseIndex : -9 })`
    : "";

  const canCopy = !!selected && selected.value !== customValue && !!selected.stops && !!paths.stops;

  const copyIntoCustom = () => {
    if ( !canCopy || !selected?.stops ) {
      return;
    }

    const options = {
      shouldDirty: true,
      shouldTouch: true
    };

    setValue(
      paths.stops as string,
      deepClone( selected.stops ),
      options
    );

    if ( paths.hardness && typeof selected.hardness === "number" ) {
      setValue(
        paths.hardness,
        selected.hardness,
        options
      );
    }

    if ( paths.paper && selected.paper ) {
      setValue(
        paths.paper,
        {
          ...( getValues( paths.paper ) ?? {} ),
          ...deepClone( selected.paper )
        },
        options
      );
    }

    setValue(
      name,
      customValue,
      options
    );
  };

  const registration = register( name );

  // The bar IS the collapsible's header: CollapsibleItem makes it a keyboard
  // button (Enter / Space, aria-expanded) around the label segment, whose own
  // reset button stops its click from toggling. The swatch shows the look in
  // use while the grid is shut, so the panel stays one line tall at rest.
  return (
    <CollapsibleItem
      expanded={ open }
      onToggle={ setOpen }
      headerContainerClassName="rounded-lg"
      header={ () => (
        <div className={ clsx(
          CONTROL_BAR_CLASS,
          "relative cursor-pointer hover:bg-hover",
          cycle && "binding-live-ring"
        ) }>
          <BarLabelSegment
            label={ label }
            icon={ <Palette className="h-4 w-4 md:h-3 md:w-3 shrink-0 text-label" /> }
            isModified={ isModified }
            onReset={ onReset }
          />

          <span className="relative flex h-full min-w-0 flex-1 items-center gap-2 px-2.5">
            <span className="relative h-4 w-10 shrink-0 md:h-3.5">
              <Swatch look={ selectedLook } className="h-full w-full p-[2px]" />
              {cycle?.map( (
                value, index
              ) => (
                <Swatch
                  key={ `${ String( value ) }-${ index }` }
                  look={ lookOf( optionOf( value ) ) }
                  className="absolute inset-0 p-[2px]"
                  style={ {
                    opacity: litAt(
                      indexVar,
                      index
                    )
                  } }
                />
              ) )}
            </span>
            {cycle && live && cycleLabels ? (
              <span className="flex min-w-0 flex-1 items-center gap-1">
                <LiveBindingValue
                  target={ live.target }
                  fallback={ selected?.label ?? current ?? "—" }
                  labels={ cycleLabels }
                  className="min-w-0 truncate text-foreground"
                />
                {/* The base yields its room first: the live palette is the
                    news, and its swatch already sits beside it. */}
                <span className="min-w-0 shrink-[99] truncate text-label">· {selected?.label ?? current ?? "—"}</span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate">{selected?.label ?? current ?? "—"}</span>
            )}
            <ChevronDown
              className={ clsx(
                CONTROL_CHEVRON_CLASS,
                "transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180"
              ) }
            />

            {cycle && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2.5 bottom-0.5 grid h-[3px] gap-0.5"
                style={ {
                  gridTemplateColumns: `repeat(${ cycle.length }, minmax(0, 1fr))`
                } }
              >
                {cycle.map( (
                  value, index
                ) => (
                  <span
                    key={ `${ String( value ) }-${ index }` }
                    className="relative overflow-hidden rounded-full bg-foreground/15"
                  >
                    <span
                      className="binding-iridescent absolute inset-0"
                      style={ {
                        opacity: litAt(
                          indexVar,
                          index
                        )
                      } }
                    />
                  </span>
                ) )}
              </span>
            )}
          </span>
        </div>
      ) }
    >
      {/* The spacing lives inside the content, never on CollapsibleItem's
          own wrapper: padding there survives the 0fr collapse and left the
          shut picker 10px taller than its bar. */}
      <div
        role="radiogroup"
        aria-label={ label ?? name }
        className="space-y-2 pb-2 pt-2"
      >
        {groups.map( ( [
          group,
          options
        ] ) => (
          <div key={ group || "_" } className="space-y-1">
            {group && (
              <div className="text-[10px] font-medium uppercase tracking-wider text-label">{group}</div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {options.map( ( option ) => {
                const isSelected = option.value === ( current ?? customValue );
                const cycleIndex = cycle
                  ? cycle.findIndex( ( value ) => String( value ) === option.value )
                  : -1;

                return (
                  <label
                    key={ option.value }
                    title={ option.description ?? option.label }
                    className="group relative block cursor-pointer"
                  >
                    <input
                      type="radio"
                      value={ option.value }
                      className="peer sr-only"
                      { ...registration }
                    />
                    <span
                      className={ clsx(
                        "flex flex-col gap-1 rounded-lg border p-1 transition-colors",
                        "peer-focus-visible:ring-1 peer-focus-visible:ring-focus",
                        isSelected
                          ? "border-foreground bg-foreground/5"
                          : "border-theme hover:bg-hover"
                      ) }
                    >
                      <Swatch look={ lookOf( option ) } className="h-7 p-1 md:h-6" />
                      {/* A tile the binding does not reach keeps the row's
                          height with an empty slot. */}
                      {cycle && cycleIndex < 0 && <span aria-hidden className="mx-0.5 h-[3px]" />}
                      {cycleIndex >= 0 && (
                        <span
                          aria-hidden
                          className="relative mx-0.5 h-[3px] overflow-hidden rounded-full bg-foreground/15"
                        >
                          <span
                            className="binding-iridescent absolute inset-0"
                            style={ {
                              opacity: litAt(
                                indexVar,
                                cycleIndex
                              )
                            } }
                          />
                        </span>
                      )}
                      <span className="flex min-w-0 items-center gap-1 px-0.5">
                        <span
                          className={ clsx(
                            "min-w-0 flex-1 truncate text-[11px] leading-4",
                            isSelected ? "font-medium text-foreground" : "text-label"
                          ) }
                        >
                          {option.label}
                        </span>
                        {isSelected && <Check className="h-3 w-3 shrink-0 text-foreground" />}
                      </span>
                    </span>
                  </label>
                );
              } )}
            </div>
          </div>
        ) )}

        {canCopy && (
          <button
            type="button"
            onClick={ copyIntoCustom }
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-theme px-2 py-2 text-label hover:bg-hover hover:text-foreground md:py-1"
          >
            <Copy className="h-3.5 w-3.5 md:h-3 md:w-3" />
            <span>Edit a copy of “{selected?.label}”</span>
          </button>
        )}
      </div>
    </CollapsibleItem>
  );
}
