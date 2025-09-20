"use client";

import React from "react";
import {
  GripVertical
} from "lucide-react";
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
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  CSS
} from "@dnd-kit/utilities";
import {
  restrictToVerticalAxis, restrictToParentElement
} from "@dnd-kit/modifiers";

import AddItemControls from "./components/AddItemControls/AddItemControls";
import GenericItemForm from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/GenericItemForm";
import useContentArray from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentArrayProvider/hooks/useContentArray";
import clsx from "clsx";

type ContentItemsProps = {
  baseFieldName: "content" | `slides.${ number }.content`;
};

export type DragBinder = {
  handleProps: ReturnType<typeof useSortable>["attributes"] &
    NonNullable<ReturnType<typeof useSortable>["listeners"]>;
  setHandleRef: ReturnType<typeof useSortable>["setActivatorNodeRef"];
  isDragging: boolean;
};

function SortableRow( props: {
  id: string;
  children: ( drag: DragBinder ) => React.ReactNode;
} ) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable( {
    id: props.id
  } );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString( transform ),
    transition,
  };

  const handleProps = {
    ...( attributes as object ),
    ...( listeners as object )
  } as DragBinder["handleProps"];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "relative",
        "data-[dragging=true]:opacity-70",
        // isDragging && "cursor-grab active:cursor-grabbing",
      )}
      data-dragging={isDragging ? "true" : "false"}
    >
      {props.children( {
        handleProps,
        isDragging,
        setHandleRef: setActivatorNodeRef,
      } )}
    </div>
  );
}

export default function ContentItems( {
  baseFieldName
}: ContentItemsProps ) {
  const {
    fields, remove, move
  } = useContentArray();

  // Sensors for mouse/touch/keyboard
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

  const ids = React.useMemo(
    () => fields.map( ( f ) => f.id ),
    [
      fields
    ]
  );

  const onDragEnd = React.useCallback(
    ( evt: DragEndEvent ) => {
      const {
        active, over
      } = evt;

      if ( !over || active.id === over.id ) return;

      const from = fields.findIndex( ( f ) => f.id === active.id );
      const to = fields.findIndex( ( f ) => f.id === over.id );

      if ( from !== -1 && to !== -1 && from !== to ) {
        move(
          from,
          to
        );
      }
    },
    [
      fields,
      move
    ]
  );

  return (
    <div className="flex flex-col gap-1 text-xs">
      <AddItemControls />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[
          restrictToVerticalAxis,
          restrictToParentElement
        ]}
      >
        <SortableContext
          items={ids}
          strategy={verticalListSortingStrategy}
        >
          {fields.map( (
            field, index
          ) => (
            <SortableRow key={field.id} id={field.id}>
              {( dragBinder ) => (
                <GenericItemForm
                  index={index}
                  dragBinder={dragBinder}
                  baseFieldName={baseFieldName}
                  onRemove={() => remove( index )}
                />
              )}
            </SortableRow>
          ) )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
