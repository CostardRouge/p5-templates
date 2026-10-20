"use client";

import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  SceneCutSchema
} from "@/types/sketch.types";
import FieldRenderer from "./FieldRenderer";
import {
  sceneCutFieldConfigs
} from "./ContentItems/constants/field-config";

type Props = {
  /** The slide being edited, or undefined for the root document. */
  activeIndex: number | undefined;
};

/**
 * The slide's (or the document's) scene cut: how its loop opens out of a
 * colour plate and closes back into it, through the sequence item's GL
 * transition catalogue (runtime in slides/common/drawSceneCut.js).
 *
 * The block is optional in the schema and absent until switched on, like the
 * montage: enabling parses the whole default block in so every control below
 * binds to a defined value. The controls themselves are the generic form
 * renderer over the same field configs the sequence's scenes use — one
 * vocabulary for every transition in the studio.
 */
export default function SceneCutSettings( {
  activeIndex
}: Props ) {
  const {
    control, setValue
  } = useFormContext();
  const base = activeIndex === undefined ? "cut" : `slides.${ activeIndex }.cut`;

  const cut = useWatch( {
    control,
    name: base
  } ) as Record<string, unknown> | undefined;

  const enabled = Boolean( cut?.enabled );

  const handleToggle = ( on: boolean ) => {
    if ( on ) {
      setValue(
        base,
        SceneCutSchema.parse( {
          ...( cut ?? {} ),
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
        <span className="truncate">Scene cut (in / out)</span>
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
          {/* Depth 1: inside this card the groups take the indent-guide
              treatment, not the full-bleed band a section child gets. */}
          <FieldRenderer
            fieldBasePath={ base }
            fieldName="in"
            config={ sceneCutFieldConfigs.in }
            depth={ 1 }
          />
          <FieldRenderer
            fieldBasePath={ base }
            fieldName="out"
            config={ sceneCutFieldConfigs.out }
            depth={ 1 }
          />
          <FieldRenderer
            fieldBasePath={ base }
            fieldName="plate"
            config={ sceneCutFieldConfigs.plate }
            depth={ 1 }
          />

          <p className="px-1 pt-0.5 text-[0.65rem] leading-snug text-label">
            Opens the loop out of the plate and closes it back into it, through
            the same transitions a sequence uses. Slides joined in one export
            then cut like a film; a lone loop gets a bookend.
          </p>
        </div>
      )}
    </div>
  );
}
