import {
  GripVertical, Plus, Copy, Trash2
} from "lucide-react";
import {
  SortableContext, useSortable, rectSwappingStrategy
} from "@dnd-kit/sortable";
import {
  closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors
} from "@dnd-kit/core";

import type {
  SlideOption
} from "@/types/sketch.types";
import {
  CSS
} from "@dnd-kit/utilities";
import clsx from "clsx";

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
  const sensors = useSensors( useSensor(
    PointerSensor,
    {
      activationConstraint: {
        distance: 6
      }
    }
  ) );

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

  const alignedIds = slides.map( (
    _slide, index
  ) => slideIds[ index ] ?? String( index ) );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div
        onDragOver={( event ) => event.preventDefault()}
        className="p-1 grid grid-cols-2 gap-1 min-h-8"
      >
        <SortableContext items={alignedIds} strategy={rectSwappingStrategy}>
          {slides.map( (
            slide, slideIndex
          ) => (
            <SlideThumbnail
              key={alignedIds[ slideIndex ]}
              id={alignedIds[ slideIndex ]}
              index={slideIndex}
              isActive={slideIndex === activeIndex}
              label={slide.name || `Slide ${ slideIndex }`}
              onClick={() => onSelect( slideIndex )}
              onDuplicate={() => onDuplicate( slideIndex )}
              onDelete={() => onDelete( slideIndex )}
            />
          ) )}
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
  index,
  isActive,
  label,
  onClick,
  onDuplicate,
  onDelete
}: {
  id: string;
  index: number;
  isActive: boolean;
  label: string;
  onClick: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
} ) {
  const {
    attributes, listeners, setNodeRef, transform, transition
  } = useSortable( {
    id
  } );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString( transform ),
    transition,
  };

  return (
    <div
      style={style}
      ref={setNodeRef}
      onClick={onClick}
      className={clsx(
        "relative bg-white border border-gray-300 flex items-center px-1 h-8 cursor-pointer rounded-sm",
        {
          "border-gray-400": isActive
        }
      )}
    >
      <GripVertical
        className="h-4 w-4 text-gray-400 mr-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />

      <span className="text-xs truncate">{label}</span>

      <button
        type="button"
        onClick={( event ) => {
          event.stopPropagation();
          onDuplicate();
        }}
        className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded hover:bg-gray-100"
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
        className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-gray-100"
        aria-label="Delete slide"
        title="Delete slide"
      >
        <Trash2 className="h-3.5 w-3.5 text-gray-500" />
      </button>
    </div>
  );
}
