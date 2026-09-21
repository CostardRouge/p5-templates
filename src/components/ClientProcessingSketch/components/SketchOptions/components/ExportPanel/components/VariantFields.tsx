"use client";

import React from "react";
import clsx from "clsx";
import {
  framerateOptionsFor,
  type ExportSize,
  type ExportVariant
} from "@/lib/export/variants";
import type {
  RecordingFormat
} from "@/engines/recording";
import ExportSizeSelect from "./ExportSizeSelect";

/**
 * What file the variant produces, as one choice.
 *
 * "Kind" used to be its own control, which asked the user to say twice what
 * they wanted: a kind, and then a format inside it. What they actually pick is
 * the file they get — so video containers, a single still and a still sequence
 * share one list, and `kind` is derived from it.
 */
type OutputChoice = {
  value: string;
  label: string;
  kind: ExportVariant[ "kind" ];
  format?: RecordingFormat;
  frameCount?: ExportVariant[ "frameCount" ];
};

function outputChoices( supportedFormats: RecordingFormat[] ): OutputChoice[] {
  return [
    ...supportedFormats.map( ( format ) => ( {
      value: `video:${ format }`,
      label: format,
      kind: "video" as const,
      format
    } ) ),
    {
      value: "image",
      label: "png (still)",
      kind: "image" as const
    },
    {
      value: "frames:10",
      label: "png × 10",
      kind: "frames" as const,
      frameCount: 10
    },
    {
      value: "frames:20",
      label: "png × 20",
      kind: "frames" as const,
      frameCount: 20
    },
    {
      value: "frames:all",
      label: "png × all",
      kind: "frames" as const,
      frameCount: "all" as const
    }
  ];
}

function currentChoiceValue( variant: ExportVariant ): string {
  if ( variant.kind === "image" ) {
    return "image";
  }

  if ( variant.kind === "frames" ) {
    return `frames:${ variant.frameCount }`;
  }

  return `video:${ variant.format }`;
}

export const SELECT_CLASS =
  "w-full cursor-pointer appearance-none rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] text-foreground transition-colors hover:border-theme focus:border-theme focus:outline-none disabled:opacity-50";

/** A muted em dash: this column does not apply to this variant. */
export function NotApplicable() {
  return <span className="text-label/60">—</span>;
}

/**
 * Every control a variant owns, once.
 *
 * They live apart from any one layout because there are two: a row of grid
 * cells on a desktop dialog, a card on a phone. A control copied into both is
 * a control that gets fixed in one of them.
 */
export type VariantFieldProps = {
  variant: ExportVariant;
  running: boolean;
  onPatch: ( patch: Partial<ExportVariant> ) => void;
};

export function VariantName( {
  variant,
  running,
  onPatch,
  className
}: VariantFieldProps & {
  className?: string;
} ) {
  return (
    <input
      value={ variant.name }
      disabled={ running }
      aria-label="Variant name"
      onChange={ ( event ) => onPatch( {
        name: event.target.value
      } ) }
      className={ clsx(
        "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium text-foreground transition-colors hover:border-theme focus:border-theme focus:outline-none disabled:opacity-60",
        className ?? "text-[11.5px]"
      ) }
    />
  );
}

export function VariantSize( {
  variant,
  running,
  onPatch,
  nativeSize,
  mixedSizes
}: VariantFieldProps & {
  nativeSize: ExportSize;
  mixedSizes: boolean;
} ) {
  return (
    <ExportSizeSelect
      value={ variant.size }
      disabled={ running }
      nativeSize={ nativeSize }
      mixedSizes={ mixedSizes }
      sizeStrategy={ variant.sizeStrategy }
      onStrategyChange={ ( sizeStrategy ) => onPatch( {
        sizeStrategy
      } ) }
      onChange={ ( size ) => onPatch( {
        size
      } ) }
    />
  );
}

export function VariantOutput( {
  variant,
  running,
  onPatch,
  supportedFormats
}: VariantFieldProps & {
  supportedFormats: RecordingFormat[];
} ) {
  const choices = outputChoices( supportedFormats );

  return (
    <select
      value={ currentChoiceValue( variant ) }
      disabled={ running }
      aria-label="Output file"
      onChange={ ( event ) => {
        const choice = choices.find( ( entry ) => entry.value === event.target.value );

        if ( !choice ) {
          return;
        }

        onPatch( {
          kind: choice.kind,
          ...( choice.format ? {
            format: choice.format
          } : {} ),
          ...( choice.frameCount !== undefined ? {
            frameCount: choice.frameCount
          } : {} )
        } );
      } }
      className={ clsx(
        SELECT_CLASS,
        "font-mono"
      ) }
    >
      {choices.map( ( choice ) => (
        <option key={ choice.value } value={ choice.value }>
          {choice.label}
        </option>
      ) )}
    </select>
  );
}

export function VariantRate( {
  variant,
  running,
  onPatch,
  nativeFramerate
}: VariantFieldProps & {
  nativeFramerate: number;
} ) {
  if ( variant.kind !== "video" ) {
    return <NotApplicable />;
  }

  const framerates = framerateOptionsFor( nativeFramerate );
  const effectiveFramerate = Math.min(
    variant.framerate ?? nativeFramerate,
    nativeFramerate
  );

  return (
    <select
      value={ String( effectiveFramerate ) }
      disabled={ running }
      aria-label="Frame rate"
      onChange={ ( event ) => {
        const rate = Number( event.target.value );

        // Choosing the sketch's own rate means following it, not pinning a
        // number that happens to match today — so a later change to the sketch
        // still carries the variant with it.
        onPatch( {
          framerate: rate === nativeFramerate ? null : rate
        } );
      } }
      className={ SELECT_CLASS }
      title={ `The sketch renders at ${ nativeFramerate } fps` }
    >
      {framerates.map( ( rate ) => (
        <option key={ rate } value={ rate }>{rate}</option>
      ) )}
    </select>
  );
}

export function VariantSlides( {
  variant,
  running,
  onPatch,
  slideCount
}: VariantFieldProps & {
  slideCount: number;
} ) {
  if ( slideCount === 0 ) {
    return <NotApplicable />;
  }

  return (
    <select
      value={ Array.isArray( variant.slides ) ? "all" : variant.slides }
      disabled={ running }
      aria-label="Slides"
      onChange={ ( event ) => onPatch( {
        slides: event.target.value as ExportVariant[ "slides" ]
      } ) }
      className={ SELECT_CLASS }
    >
      <option value="current">Current</option>
      <option value="all">All {slideCount}</option>
    </select>
  );
}

/**
 * What the variant hands back: a `.zip`, one file, or — for several slides of
 * video — a choice between the two.
 */
export function VariantDelivery( {
  variant,
  running,
  onPatch,
  slideSpan,
  align
}: VariantFieldProps & {
  slideSpan: number;
  align?: "right";
} ) {
  if ( slideSpan > 1 && variant.kind === "video" ) {
    return (
      <select
        value={ variant.delivery }
        disabled={ running }
        aria-label="Delivery"
        onChange={ ( event ) => onPatch( {
          delivery: event.target.value as ExportVariant[ "delivery" ]
        } ) }
        className={ clsx(
          SELECT_CLASS,
          align === "right" && "text-right"
        ) }
      >
        <option value="separate">.zip</option>
        <option value="combined">one {variant.format}</option>
      </select>
    );
  }

  return (
    <span className="font-mono text-[11px] text-label">
      {slideSpan > 1 || variant.kind === "frames" ? ".zip" : "1 file"}
    </span>
  );
}
