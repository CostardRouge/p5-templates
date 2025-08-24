import {
  GripVertical, Plus
} from "lucide-react";
import {
  arrayMove, SortableContext, useSortable, rectSwappingStrategy
} from "@dnd-kit/sortable";
import {
  closestCenter, DndContext, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";

import type {
  SlideOption
} from "@/types/sketch.types";
import {
  CSS
} from "@dnd-kit/utilities";
import clsx from "clsx";

export default function SlideCarousel( {
  slides,
  activeIndex,
  onSelect,
  onReorder,
  onAdd,
}: {
  slides: SlideOption[];
  activeIndex: number;
  onSelect: ( i: number ) => void;
  onReorder: ( newIndex: number, oldIndex: number ) => void;
  onAdd: () => void;
} ) {
  const sensors = useSensors( useSensor( PointerSensor ) );

  const handleDragEnd = ( evt: any ) => {
    const {
      active, over
    } = evt;

    if ( !over || active.id === over.id ) {
      return;
    }

    const oldIdx = slides.findIndex( ( s ) => s.name === active.id );
    const newIdx = slides.findIndex( ( s ) => s.name === over.id );

    if ( oldIdx === newIdx ) {
      return;
    }

    // if ( oldIdx < 0 || newIdx < 0 ) {
    //   return;
    // }

    // onReorder( arrayMove(
    //   slides,
    //   oldIdx,
    //   newIdx
    // ) );

    onReorder(
      oldIdx,
      newIdx
    );
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div
        onDragOver={( e ) => e.preventDefault()}
        className="p-1 grid grid-cols-2 gap-1 min-h-8"
      >
        <SortableContext
          items={slides.map( ( s ) => s.name ?? String( Math.random() ) )}
          strategy={rectSwappingStrategy}
        >
          {slides.map( (
            slide, slideIndex
          ) => (
            <SlideThumb
              key={slide.name ?? slideIndex}
              id={slide.name ?? slideIndex.toString()}
              index={slideIndex}
              active={slideIndex === activeIndex}
              onClick={() => onSelect( slideIndex )}
            />
          ) )}
        </SortableContext>

        <button
          onClick={onAdd}
          className="flex items-center justify-center h-8 text-gray-500 border border-dashed border-gray-300 hover:bg-gray-100 hover:text-black rounded-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span className="text-xs">new slide</span>
        </button>
      </div>
    </DndContext>
  );
}

function SlideThumb( {
  id, index, active, onClick
}: {
 id: string; index: number; active: boolean; onClick: () => void
} ) {
  const {
    attributes, listeners, setNodeRef, transform, transition
  } = useSortable( {
    id
  } );

  const style = {
    transform: CSS.Transform.toString( transform ),
    transition
  };

  return (
    <div
      style={style}
      ref={setNodeRef}
      onClick={onClick}
      className={clsx(
        "relative bg-white border border-gray-300 flex items-center px-1 h-8 cursor-pointer rounded-sm",
        {
          "border-gray-400": active
        }
      )}
    >
      <GripVertical
        className="h-4 w-4 text-gray-400 mr-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />
      <span className="text-xs">Slide #{index}</span>
    </div>
  );
}