import {
  Plus
} from "lucide-react";
import {
  horizontalListSortingStrategy, SortableContext
} from "@dnd-kit/sortable";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  restrictToParentElement
} from "@dnd-kit/modifiers";
import React from "react";
import clsx from "clsx";
import {
  useFormContext, useWatch
} from "react-hook-form";

import type {
  SlideOption
} from "@/types/sketch.types";
import {
  mergeSlideOverride
} from "@/lib/effectiveSlideSettings";
import {
  SortableRow
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/SortableRow";
import {
  indexToLetters
} from "@/utils/slideNaming";
import SlideThumbnail from "./SlideThumbnail";

export type SlideFilmstripProps = {
  slideFields: any[];
  slides?: SlideOption[];
  thumbnails: Record<string, string>;
  activeIndex: number | undefined;
  isAdding: boolean;
  onSelect: ( index: number ) => void;
  onReorder: ( oldIndex: number, newIndex: number ) => void;
  onAdd: () => void;
  onDuplicate: ( index: number ) => void;
  onDelete: ( index: number ) => void;
  onRename: ( index: number, newName: string ) => void;
  /** Thumbnail height in px — the strip's own height derives from it. */
  thumbnailHeight?: number;
  className?: string;
};

type SizeOverride = { width?: number;
  height?: number };

/**
 * The "add a slide" slot: a dashed tile the shape and size of the slide that
 * pressing it would create, so it reads as the next position in the deck
 * rather than as a button parked next to it. Used by both branches below —
 * an empty deck is the same row with nothing but this slot in it.
 */
function AddSlideTile( {
  onAdd,
  disabled,
  height,
  aspectRatio,
  label
}: {
  onAdd: () => void;
  disabled: boolean;
  height: number;
  aspectRatio: number;
  label: string;
} ) {
  return (
    <button
      type="button"
      onClick={ onAdd }
      disabled={ disabled }
      className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-theme text-label hover:bg-hover hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={ {
        height,
        width: Math.round( height * aspectRatio )
      } }
      aria-label={ label }
      title={ label }
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

/**
 * Horizontal strip of slide thumbnails — the deck laid out in the page body,
 * Keynote-style, instead of folded into an options accordion. Slides are a
 * collection of variants (each one on its way to being a preset), not a
 * timeline: the strip deliberately stays separate from the animation
 * progression bar. With no slides it renders a single invite: adding the
 * first slide promotes the whole current state (see useSlideManagement), so
 * there is nothing to configure and nothing to lose.
 */
export default function SlideFilmstrip( {
  slideFields,
  slides,
  thumbnails,
  activeIndex,
  isAdding,
  onSelect,
  onReorder,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
  thumbnailHeight = 72,
  className
}: SlideFilmstripProps ) {
  const {
    control
  } = useFormContext();

  // Per-slide aspect ratio: the slide's own size override wins, the global
  // canvas size fills in — same precedence as getEffectiveSlideSettings, so
  // thumbnails keep the shape of what they render.
  const globalSize = useWatch( {
    control,
    name: "size"
  } ) as SizeOverride | undefined;

  const slideIds = slideFields.map( ( field ) => field.id );

  const sensors = useSensors(
    useSensor(
      MouseSensor,
      {
        activationConstraint: {
          distance: 6
        }
      }
    ),
    useSensor(
      TouchSensor,
      {
        activationConstraint: {
          delay: 120,
          tolerance: 8
        }
      }
    ),
    useSensor( KeyboardSensor )
  );

  const handleDragEnd = ( event: DragEndEvent ) => {
    const {
      active, over
    } = event;

    if ( !over || active.id === over.id ) {
      return;
    }

    const oldIndex = slideIds.indexOf( String( active.id ) );
    const newIndex = slideIds.indexOf( String( over.id ) );

    if ( oldIndex < 0 || newIndex < 0 || oldIndex === newIndex ) {
      return;
    }

    onReorder(
      oldIndex,
      newIndex
    );
  };

  const aspectRatioFor = ( index: number ): number => {
    const merged = mergeSlideOverride(
      globalSize,
      slides?.[ index ]?.size as SizeOverride | undefined
    );
    const ratio =
      merged?.width && merged?.height ? merged.width / merged.height : 0.8;

    // Clamp so one extreme banner format cannot eat the whole strip.
    return Math.min(
      2.4,
      Math.max(
        0.4,
        ratio
      )
    );
  };

  // A new slide inherits the active slide's settings (see useSlideManagement),
  // so the add slot takes that slide's shape — and the canvas's when the deck
  // is empty (an out-of-range index resolves to the global size).
  const addAspectRatio = aspectRatioFor( activeIndex ?? -1 );

  if ( slideFields.length === 0 ) {
    // Same box as the populated row — padding included. Without it the tile
    // set the card's height and its 16px corners read as a pill next to the
    // other floating panels.
    return (
      <div
        className={ clsx(
          "flex h-full w-full items-center gap-3 p-2",
          className
        ) }
      >
        <AddSlideTile
          onAdd={ onAdd }
          disabled={ isAdding }
          height={ thumbnailHeight }
          aspectRatio={ addAspectRatio }
          label="Add first slide"
        />

        {/* Desktop-only copy: in the phone's deck card the slot speaks for
            itself and this sentence only ever truncated. */}
        <span className="hidden min-w-0 md:block">
          <span className="line-clamp-2 text-xs text-label">
            Single view — the first slide starts a collection from what is on
            screen.
          </span>
        </span>
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={ closestCenter }
      onDragEnd={ handleDragEnd }
      sensors={ sensors }
      modifiers={ [
        restrictToParentElement
      ] }
    >
      <div
        className={ clsx(
          // items-center now that a slide is a bare thumbnail: the name moved
          // inside the tile, so every item in the row — add slot included — is
          // one rectangle of the same height and they centre cleanly.
          // The padding is deliberately UNIFORM (p-2 = 8px): the tile's 8px
          // radius is only concentric with the filmstrip card's 16px one when
          // the inset is the same on every side (8 = 16 - 8). Splitting it
          // back into px-3/py-1.5 breaks that on both axes at once.
          // touch-pan-x: a vertical drag started on a thumbnail must fall
          // through to the drawer's own scroll instead of being eaten here.
          "flex h-full w-full items-center gap-2 overflow-x-auto overflow-y-hidden touch-pan-x p-2",
          className
        ) }
      >
        <SortableContext
          items={ slideIds }
          strategy={ horizontalListSortingStrategy }
        >
          {slideFields.map( (
            field, index
          ) => {
            const slide = slides
              ? slides[ index ]
              : ( field.value as SlideOption );
            const id = field.id;
            const thumbnail = thumbnails[ id ] || null;
            const name = slide?.name || indexToLetters( index );
            const aspectRatio = aspectRatioFor( index );

            return (
              <SortableRow key={ id } id={ id }>
                {( dragBinder ) => (
                  <div
                    className="shrink-0"
                    style={ {
                      width: Math.round( thumbnailHeight * aspectRatio )
                    } }
                  >
                    <SlideThumbnail
                      id={ id }
                      name={ name }
                      isActive={ index === activeIndex }
                      thumbnailUrl={ thumbnail }
                      aspectRatio={ aspectRatio }
                      onSelect={ () => onSelect( index ) }
                      onRename={ ( newName ) => onRename(
                        index,
                        newName
                      ) }
                      onDelete={ () => onDelete( index ) }
                      onDuplicate={ () => onDuplicate( index ) }
                      dragBinder={ dragBinder }
                    />
                  </div>
                )}
              </SortableRow>
            );
          } )}
        </SortableContext>

        <AddSlideTile
          onAdd={ onAdd }
          disabled={ isAdding }
          height={ thumbnailHeight }
          aspectRatio={ addAspectRatio }
          label="Add new slide"
        />
      </div>
    </DndContext>
  );
}
