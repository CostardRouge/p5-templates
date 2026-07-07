"use client";

import React from "react";
import {
  useController, useFormContext, useWatch
} from "react-hook-form";
import {
  CONTROL_CARD_CLASS
} from "../../constants/control-bar";
import {
  CardLabelHeader
} from "../ControlChrome";
import {
  indexToLetters
} from "@/utils/slideNaming";

type Props = {
  /** Field path to a string[] of slide ids (e.g. slides.2.transition.slideIds). */
  name: string;
  /** Index of the slide being edited — excluded from the pickable list. */
  activeIndex: number;
  label?: string;
};

/**
 * Picker for a montage's source slides. Like {@link ControlledSourceSelect}, the
 * option list is dynamic (the other slides in the deck), so it reads the live
 * `slides` array from the form rather than a static config. Selections are
 * stored as persisted slide ids, which survive reorder / duplicate / reload.
 */
export default function ControlledSlideMultiSelect( {
  name,
  activeIndex,
  label
}: Props ) {
  const {
    control
  } = useFormContext();
  const {
    field
  } = useController( {
    name,
    control
  } );

  const slides = useWatch( {
    control,
    name: "slides"
  } ) as Array<{ id?: string;
    name?: string }> | undefined;

  const selected: string[] = Array.isArray( field.value )
    ? ( field.value as string[] )
    : [];

  const others = ( slides ?? [] )
    .map( (
      slide, index
    ) => ( {
      id: slide?.id,
      name: slide?.name,
      index
    } ) )
    .filter( ( slide ) =>
      slide.index !== activeIndex &&
        typeof slide.id === "string" &&
        slide.id.length > 0 );

  const toggle = (
    id: string, checked: boolean
  ) => {
    const next = checked
      ? [
        ...selected,
        id
      ]
      : selected.filter( ( value ) => value !== id );

    field.onChange( next );
  };

  return (
    <div className={ CONTROL_CARD_CLASS }>
      <CardLabelHeader label={ label } />

      {others.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-label">
          No other slides to morph between.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-theme/60">
          {others.map( ( slide ) => {
            const id = slide.id as string;
            const checked = selected.includes( id );

            return (
              <label
                key={ id }
                className="flex min-h-[2.5rem] md:min-h-0 cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 md:py-1 select-none transition-colors hover:bg-hover/50"
              >
                <span className="min-w-0 truncate">
                  {slide.name || indexToLetters( slide.index )}
                </span>
                <input
                  type="checkbox"
                  checked={ checked }
                  onChange={ ( e ) => toggle(
                    id,
                    e.target.checked
                  ) }
                  className="h-4 w-4 shrink-0 accent-foreground"
                />
              </label>
            );
          } )}
        </div>
      )}
    </div>
  );
}
