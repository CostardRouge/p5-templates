"use client";

import React from "react";
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

export function SortableRow( props: {
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
    fields, remove, move, insert
  } = useContentArray();

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
    () => fields.map( ( field ) => field.id ),
    [
      fields
    ]
  );

  const handleDragEnd = React.useCallback(
    ( event: DragEndEvent ) => {
      const {
        active, over
      } = event;

      if ( !over || active.id === over.id ) {
        return;
      }

      const from = fields.findIndex( ( field ) => field.id === active.id );
      const to = fields.findIndex( ( field ) => field.id === over.id );

      if ( from < 0 || to < 0 || from === to ) {
        return;
      }

      move(
        from,
        to
      );
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
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        sensors={sensors}
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
                  onDuplicate={() => {
                    // insert( index );
                  }}
                />
              )}
            </SortableRow>
          ) )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
