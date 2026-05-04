import {
  Plus
} from "lucide-react";
import {
  rectSwappingStrategy, SortableContext
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

import type {
  SlideOption
} from "@/types/sketch.types";
import {
  restrictToParentElement
} from "@dnd-kit/modifiers";
import React from "react";
import {
  SortableRow
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/ContentItems";
import SlideThumbnail from "./SlideThumbnail";

export default function SlideCarousel( {
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
  onRename
}: {
  slideFields: any[];
  slides?: any[];
  thumbnails: Record<string, string>;
  activeIndex: number | undefined;
  isAdding: boolean;
  onSelect: ( index: number ) => void;
  onReorder: ( oldIndex: number, newIndex: number ) => void;
  onAdd: () => void;
  onDuplicate: ( index: number ) => void;
  onDelete: ( index: number ) => void;
  onRename: ( index: number, newName: string ) => void;
} ) {
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

  // Calculate aspect ratio from the first slide's sketch settings or default
  // Ideally this should come from the global sketch settings, but we can infer it
  // For now, let's assume a standard vertical ratio if not available, or try to get it from props if we passed it
  // Since we don't have global options here, we'll default to 0.8 (4:5) which is common for social
  const aspectRatio = 0.8;

  return (
    <DndContext
      collisionDetection={ closestCenter }
      onDragEnd={ handleDragEnd }
      sensors={ sensors }
      modifiers={ [
        restrictToParentElement
      ] }
    >
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 p-1">
          <SortableContext items={ slideIds } strategy={ rectSwappingStrategy }>
            {slideFields.map( (
              field, index
            ) => {
              const slide = slides
                ? slides[ index ]
                : ( field.value as SlideOption );
              const id = field.id;
              const thumbnail = thumbnails[ id ] || null;
              const name = slide?.name || `Slide ${ index + 1 }`;

              return (
                <SortableRow key={ id } id={ id }>
                  {( dragBinder ) => (
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
                  )}
                </SortableRow>
              );
            } )}
          </SortableContext>

          <button
            type="button"
            onClick={ onAdd }
            disabled={ isAdding }
            className="flex flex-col items-center justify-center border border-dashed border-theme rounded-lg hover:bg-secondary/10 transition-colors text-muted-foreground hover:text-foreground gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={ {
              aspectRatio
            } }
            aria-label="Add new slide"
            title="Add new slide"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">Add slide</span>
          </button>
        </div>
      </div>
    </DndContext>
  );
}
