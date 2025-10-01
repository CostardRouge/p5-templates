import {
  Plus, Copy, Trash2
} from "lucide-react";
import {
  SortableContext, rectSwappingStrategy
} from "@dnd-kit/sortable";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  type DragEndEvent,
} from "@dnd-kit/core";

import type {
  SlideOption
} from "@/types/sketch.types";
import clsx from "clsx";
import {
  restrictToParentElement, restrictToVerticalAxis
} from "@dnd-kit/modifiers";
import React from "react";
import {
  DragBinder, SortableRow
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/ContentItems";

export default function SlideCarousel( {
  slideIds,
  slides,
  activeIndex,
  onSelect,
  onReorder,
  onAdd,
  onDuplicate,
  onDelete
}: {
  slideIds: string[];
  slides: SlideOption[];
  activeIndex: number;
  onSelect: ( index: number ) => void;
  onReorder: ( oldIndex: number, newIndex: number ) => void;
  onAdd: () => void;
  onDuplicate: ( index: number ) => void;
  onDelete: ( index: number ) => void;
} ) {
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

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
      modifiers={[
        restrictToVerticalAxis,
        restrictToParentElement
      ]}
    >
      <div
        onDragOver={( event ) => event.preventDefault()}
        className="grid grid-cols-1 gap-1 min-h-8"
      >
        <SortableContext
          items={slideIds} strategy={rectSwappingStrategy}
        >
          {slides.map( (
            slide, index
          ) => {
            const id = slideIds[ index ];

            return (
              <SortableRow key={`${ id }-${ index }`} id={id}>
                {( dragBinder ) => (
                  <SlideThumbnail
                    id={id}
                    dragBinder={dragBinder}
                    isActive={index === activeIndex}
                    label={`Slide ${ index + 1 }`}
                    onClick={() => onSelect( index )}
                    onDelete={() => onDelete( index )}
                    onDuplicate={() => onDuplicate( index )}
                  />
                )}
              </SortableRow>
            );
          } )}
        </SortableContext>

        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center h-8 text-gray-500 border border-dashed border-gray-300 hover:bg-gray-100 hover:text-black rounded-sm"
          aria-label="Add new slide"
          title="Add new slide"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span className="text-xs">new slide</span>
        </button>
      </div>
    </DndContext>
  );
}

function SlideThumbnail( {
  id,
  isActive,
  label,
  onClick,
  onDuplicate,
  onDelete,
  dragBinder
}: {
  id: string;
  isActive: boolean;
  label: string;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragBinder?: DragBinder;
} ) {
  return (
    <div
      ref={dragBinder?.setHandleRef}
      {
        ...( dragBinder?.handleProps ?? {
        } )
      }
      onClick={onClick}
      className={clsx(
        "relative bg-white border border-gray-200 hover:border-gray-300 flex items-center p-1 h-8 rounded-sm",
        "cursor-grab",
        {
          "border-gray-400 hover:border-gray-400": isActive,
          "opacity-70 cursor-grabbing z-20": dragBinder?.isDragging
        }
      )}
    >
      <span className="text-xs text-black truncate">{label}</span>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={( event ) => {
            event.stopPropagation();
            onDuplicate();
          }}
          className="cursor-copy inline-flex items-center justify-center"
          aria-label="Duplicate slide"
          title="Duplicate slide"
        >
          <Copy className="h-3.5 w-3.5 text-gray-500" />
        </button>

        <button
          type="button"
          onClick={( event ) => {
            event.stopPropagation();
            onDelete();
          }}
          className="inline-flex items-center justify-center"
          aria-label="Delete slide"
          title="Delete slide"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-500"/>
        </button>
      </div>

    </div>
  );
}
