"use client";

import React from "react";
import {
  useSortable
} from "@dnd-kit/sortable";
import {
  CSS
} from "@dnd-kit/utilities";
import clsx from "clsx";

/**
 * What a sortable row hands its content so the content can decide WHICH part
 * of itself is the drag handle. Rows that are also buttons (a layer row, a
 * slide tile) must not make their whole surface the activator, or the drag
 * listeners swallow the click.
 */
export type DragBinder = {
  handleProps: ReturnType<typeof useSortable>[ "attributes" ] &
    NonNullable<ReturnType<typeof useSortable>[ "listeners" ]>;
  setHandleRef: ReturnType<typeof useSortable>[ "setActivatorNodeRef" ];
  isDragging: boolean;
};

/**
 * One dnd-kit sortable row. Shared by the layers list, the slide filmstrip and
 * the slide thumbnails — the three places the studio lets you reorder things.
 */
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
    isDragging
  } = useSortable( {
    id: props.id
  } );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString( transform ),
    transition
  };

  const handleProps = {
    ...( attributes as object ),
    ...( listeners as object )
  } as DragBinder[ "handleProps" ];

  return (
    <div
      ref={ setNodeRef }
      style={ style }
      className={ clsx(
        "relative",
        "data-[dragging=true]:opacity-70"
      ) }
      data-dragging={ isDragging ? "true" : "false" }
    >
      {props.children( {
        handleProps,
        isDragging,
        setHandleRef: setActivatorNodeRef
      } )}
    </div>
  );
}

export default SortableRow;
