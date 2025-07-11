import {
  GripVertical, Plus
} from "lucide-react";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy
} from "@dnd-kit/sortable";
import {
  closestCenter, DndContext, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";

import type {
  SlideOptions
} from "@/types/sketch.types";

export function SlideCarousel( {
  slides,
  activeIndex,
  onSelect,
  onReorder,
  onAdd,
}: {
  slides: SlideOptions[];
  activeIndex: number;
  onSelect: ( i: number ) => void;
  onReorder: ( list: SlideOptions[] ) => void;
  onAdd: () => void;
} ) {
  const sensors = useSensors( useSensor( PointerSensor ) );

  const handleDragEnd = ( evt: any ) => {
    const {
      active, over
    } = evt;

    if ( !over ) return;
    const oldIdx = slides.findIndex( ( s ) => s.name === active.id );
    const newIdx = slides.findIndex( ( s ) => s.name === over.id );

    if ( oldIdx === newIdx ) return;
    onReorder( arrayMove(
      slides,
      oldIdx,
      newIdx
    ) );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-2 overflow-x-auto p-2">
        <SortableContext items={slides.map( ( s ) => s.name ?? String( Math.random() ) )} strategy={verticalListSortingStrategy}>
          {slides.map( (
            slide, i
          ) => (
            <SlideThumb
              key={slide.name ?? i}
              id={slide.name ?? i.toString()}
              index={i}
              active={i === activeIndex}
              onClick={() => onSelect( i )}
            />
          ) )}
        </SortableContext>

        {/* Add button */}
        <button
          onClick={onAdd}
          className="flex h-24 w-20 flex-col items-center justify-center rounded border border-dashed text-gray-500 hover:bg-gray-100"
        >
          <Plus className="h-6 w-6" />
          <span className="text-xs">Add</span>
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

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: `translateY(${ transform?.y ?? 0 }px)`,
        transition
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`relative h-24 w-20 shrink-0 cursor-pointer overflow-hidden rounded border 
                  ${ active ? "border-blue-500" : "border-gray-300" }`}
    >
      <GripVertical className="absolute left-1 top-1 h-4 w-4 text-gray-400" />
      <span className="absolute bottom-1 right-1 text-xs text-white">{index + 1}</span>
    </div>
  );
}