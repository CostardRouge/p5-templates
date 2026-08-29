"use client";

import React from "react";
import clsx from "clsx";
import {
  CONTROL_BAR_CLASS,
  CONTROL_BAR_INPUT_CLASS,
  CONTROL_CHEVRON_CLASS,
  CONTROL_LABEL_SEGMENT_CLASS
} from "../../ContentItems/constants/control-bar";
import {
  ChevronDown
} from "lucide-react";
import {
  framerateOptionsFor,
  hasMixedSlideSizes,
  variantFileName,
  type ExportSize,
  type ExportVariant,
  type ExportVariantKind
} from "@/lib/export/variants";
import type {
  RecordingFormat
} from "@/engines/recording";
import type {
  SketchOption
} from "@/types/sketch.types";

type VariantEditorProps = {
  variant: ExportVariant;
  options: SketchOption;
  sketchName: string;
  slideIndices: Array<number | undefined>;
  slideCount: number;
  runSize: ExportSize;
  nativeFramerate: number;
  supportedFormats: RecordingFormat[];
  sizePresets: ExportSize[];
  disabled: boolean;
  onPatch: ( patch: Partial<ExportVariant> ) => void;
};

const KINDS: ReadonlyArray<{
  value: ExportVariantKind;
  label: string;
}> = [
  {
    value: "video",
    label: "Video"
  },
  {
    value: "image",
    label: "Image"
  },
  {
    value: "frames",
    label: "Frames"
  }
];

/** A label + control row, matching the inspector's bar chrome. */
function Field( {
  label, children
}: {
  label: string;
  children: React.ReactNode;
} ) {
  return (
    <label className={ CONTROL_BAR_CLASS }>
      <span className={ CONTROL_LABEL_SEGMENT_CLASS }>
        <span className="truncate text-[10px] uppercase tracking-wide text-label">
          {label}
        </span>
      </span>
      {children}
    </label>
  );
}

/** A native select filling a control bar, with the house chevron. */
function BarSelect( {
  value,
  onChange,
  disabled,
  children
}: {
  value: string;
  onChange: ( value: string ) => void;
  disabled?: boolean;
  children: React.ReactNode;
} ) {
  return (
    <span className="relative flex h-full min-w-0 flex-1 items-center">
      <select
        value={ value }
        disabled={ disabled }
        onChange={ ( event ) => onChange( event.target.value ) }
        className={ clsx(
          CONTROL_BAR_INPUT_CLASS,
          "cursor-pointer appearance-none pr-6 disabled:opacity-50"
        ) }
      >
        {children}
      </select>
      <ChevronDown
        className={ clsx(
          CONTROL_CHEVRON_CLASS,
          "pointer-events-none absolute right-2"
        ) }
      />
    </span>
  );
}

/** A small segmented control — the kind picker and the radio-ish groups. */
function Segmented<T extends string>( {
  value,
  options,
  onChange,
  disabled
}: {
  value: T;
  options: ReadonlyArray<{
    value: T;
    label: string;
    disabled?: boolean;
    title?: string;
  }>;
  onChange: ( value: T ) => void;
  disabled?: boolean;
} ) {
  return (
    <div className="flex gap-1">
      {options.map( ( option ) => (
        <button
          key={ option.value }
          type="button"
          disabled={ disabled || option.disabled }
          title={ option.title }
          onClick={ () => onChange( option.value ) }
          className={ clsx(
            "flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:opacity-40",
            value === option.value
              ? "border-foreground bg-foreground text-background"
              : "border-theme bg-background text-foreground hover:bg-hover"
          ) }
        >
          {option.label}
        </button>
      ) )}
    </div>
  );
}

function SectionLabel( {
  children
}: { children: React.ReactNode } ) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
      {children}
    </div>
  );
}

/**
 * The right column: everything about the selected variant.
 *
 * Kind swaps which controls are shown rather than adding a panel — a still
 * has no framerate and a video has no frame count, so showing both would be
 * an invitation to set a value that is then ignored.
 */
export default function VariantEditor( {
  variant,
  options,
  sketchName,
  slideIndices,
  slideCount,
  runSize,
  nativeFramerate,
  supportedFormats,
  sizePresets,
  disabled,
  onPatch
}: VariantEditorProps ) {
  const framerates = framerateOptionsFor( nativeFramerate );
  const effectiveFramerate = Math.min(
    variant.framerate ?? nativeFramerate,
    nativeFramerate
  );
  const sizeValue = variant.size
    ? `${ variant.size.width }x${ variant.size.height }`
    : "native";
  const isMultiSlide = slideIndices.length > 1;
  const mixedSizes = hasMixedSlideSizes(
    variant,
    options,
    slideIndices
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <input
        value={ variant.name }
        disabled={ disabled }
        onChange={ ( event ) => onPatch( {
          name: event.target.value
        } ) }
        aria-label="Variant name"
        className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-foreground transition-colors hover:border-theme focus:border-theme focus:outline-none disabled:opacity-50"
      />

      <div className="flex flex-col gap-1.5">
        <SectionLabel>Kind</SectionLabel>
        <Segmented
          value={ variant.kind }
          disabled={ disabled }
          options={ KINDS }
          onChange={ ( kind ) => onPatch( {
            kind
          } ) }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <SectionLabel>Canvas size</SectionLabel>
        <Field label="Size">
          <BarSelect
            value={ sizeValue }
            disabled={ disabled }
            onChange={ ( value ) => {
              if ( value === "native" ) {
                onPatch( {
                  size: null
                } );

                return;
              }

              const [
                width,
                height
              ] = value.split( "x" ).map( Number );

              onPatch( {
                size: {
                  width,
                  height
                }
              } );
            } }
          >
            <option value="native">Sketch&apos;s own size (per slide)</option>
            {sizePresets.map( ( preset ) => (
              <option
                key={ `${ preset.width }x${ preset.height }` }
                value={ `${ preset.width }x${ preset.height }` }
              >
                {preset.width} × {preset.height}
              </option>
            ) )}
          </BarSelect>
        </Field>

        {variant.size && (
          <div className="flex gap-1.5">
            <Field label="W">
              <input
                type="number"
                min={ 50 }
                max={ 8192 }
                disabled={ disabled }
                value={ variant.size.width }
                onChange={ ( event ) => onPatch( {
                  size: {
                    width: Number( event.target.value ) || 1,
                    height: variant.size?.height ?? 1
                  }
                } ) }
                className={ CONTROL_BAR_INPUT_CLASS }
              />
            </Field>
            <Field label="H">
              <input
                type="number"
                min={ 50 }
                max={ 8192 }
                disabled={ disabled }
                value={ variant.size.height }
                onChange={ ( event ) => onPatch( {
                  size: {
                    width: variant.size?.width ?? 1,
                    height: Number( event.target.value ) || 1
                  }
                } ) }
                className={ CONTROL_BAR_INPUT_CLASS }
              />
            </Field>
          </div>
        )}
      </div>

      {variant.kind === "video" && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Format</SectionLabel>
          <Segmented
            value={ variant.format }
            disabled={ disabled }
            options={ supportedFormats.map( ( format ) => ( {
              value: format,
              label: format
            } ) ) }
            onChange={ ( format ) => onPatch( {
              format
            } ) }
          />

          <Field label="Frame rate">
            <BarSelect
              value={ String( effectiveFramerate ) }
              disabled={ disabled }
              onChange={ ( value ) => onPatch( {
                framerate: Number( value )
              } ) }
            >
              {framerates.map( ( rate ) => (
                <option key={ rate } value={ rate }>
                  {rate} fps
                </option>
              ) )}
            </BarSelect>
          </Field>
          <p className="px-1 text-[10px] text-label">
            sketch renders at {nativeFramerate}
          </p>
        </div>
      )}

      {variant.kind === "frames" && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Frames</SectionLabel>
          <Field label="Count">
            <BarSelect
              value={ String( variant.frameCount ) }
              disabled={ disabled }
              onChange={ ( value ) => onPatch( {
                frameCount: value === "all" ? "all" : Number( value )
              } ) }
            >
              <option value="10">10 × png</option>
              <option value="20">20 × png</option>
              <option value="all">All frames</option>
            </BarSelect>
          </Field>
        </div>
      )}

      {slideCount > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Slides</SectionLabel>
          <Segmented
            value={ Array.isArray( variant.slides ) ? "pick" : variant.slides }
            disabled={ disabled }
            options={ [
              {
                value: "current",
                label: "Current"
              },
              {
                value: "all",
                label: `All (${ slideCount })`
              }
            ] }
            onChange={ ( slides ) => onPatch( {
              slides: slides as ExportVariant[ "slides" ]
            } ) }
          />
        </div>
      )}

      {variant.kind === "video" && isMultiSlide && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Deliver as</SectionLabel>
          <Segmented
            value={ variant.delivery }
            disabled={ disabled }
            options={ [
              {
                value: "separate",
                label: "Separate (.zip)"
              },
              {
                value: "combined",
                label: `One .${ variant.format }`
              }
            ] }
            onChange={ ( delivery ) => onPatch( {
              delivery
            } ) }
          />

          {mixedSizes && variant.delivery === "combined" && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-theme bg-foreground/5 p-2">
              <p className="text-[10px] leading-relaxed text-label">
                These slides use different canvas sizes. One video needs one
                size, so every slide is re-rendered at:
              </p>
              <Segmented
                value={ variant.sizeStrategy }
                disabled={ disabled }
                options={ [
                  {
                    value: "smallest",
                    label: "Smallest"
                  },
                  {
                    value: "biggest",
                    label: "Biggest"
                  },
                  {
                    value: "root",
                    label: "Root canvas"
                  }
                ] }
                onChange={ ( sizeStrategy ) => onPatch( {
                  sizeStrategy
                } ) }
              />
            </div>
          )}

          {variant.delivery === "combined" && (
            <p className="px-1 text-[10px] text-label">
              Slides are joined as hard cuts, without audio.
            </p>
          )}
        </div>
      )}

      <div className="mt-auto pt-2">
        <p className="truncate rounded-lg border border-theme bg-background px-2 py-1.5 font-mono text-[10px] text-label">
          {variantFileName(
            variant,
            sketchName,
            runSize,
            {
              bundled: isMultiSlide && variant.delivery !== "combined"
            }
          )}
        </p>
      </div>
    </div>
  );
}
