"use client";

import React from "react";
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
  SortableContext, verticalListSortingStrategy
} from "@dnd-kit/sortable";
import {
  restrictToParentElement, restrictToVerticalAxis
} from "@dnd-kit/modifiers";
import {
  useFormContext
} from "react-hook-form";

import {
  SortableRow
} from "../../SortableRow";
import AddLayerPopover from "../../ContentItems/components/AddItemControls/components/ItemPalette/AddLayerPopover";
import type {
  ItemKind
} from "../../ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";
import makeDefaultItem from "../../ContentItems/components/AddItemControls/utils/makeDefaultItem";
import useContentArray from "../../ContentArrayProvider/hooks/useContentArray";
import LayerRow from "./LayerRow";

type LayerGroupProps = {
  /** What this group's layers apply to, e.g. "this slide". Omitted when the
   *  group is the only one: the band above it already says "layers", and the
   *  panel would print the same word twice — its `+` then lives in the band's
   *  own header (OptionsPanel). */
  label?: string;
  /** Form path of the content array, e.g. `content` or `slides.1.content`. */
  baseFieldName: string;
  selectedPath: string | null;
  onSelect: ( itemPath: string ) => void;
};

/**
 * One scope's layers: a quiet header naming the scope, the rows, and a `+`
 * that opens the type palette as a popover anchored to that header.
 *
 * The palette lives per group rather than once at the foot of the panel
 * because with two scopes on screen a single add button cannot say where the
 * new layer would land.
 */
export default function LayerGroup( {
  label,
  baseFieldName,
  selectedPath,
  onSelect
}: LayerGroupProps ) {
  const {
    fields, remove, move, insert, append
  } = useContentArray();
  const {
    getValues
  } = useFormContext();

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

  const duplicateItem = React.useCallback(
    ( index: number ) => {
      const current = getValues( `${ baseFieldName }.${ index }` );
      const clone = current ? JSON.parse( JSON.stringify( current ) ) : {};

      if ( clone && typeof clone === "object" && "id" in clone ) {
        delete ( clone as Record<string, unknown> ).id;
      }

      insert(
        index + 1,
        clone
      );
    },
    [
      getValues,
      baseFieldName,
      insert
    ]
  );

  const handleAdd = React.useCallback(
    ( kind: ItemKind ) => {
      append(
        makeDefaultItem( kind ),
        {
          shouldFocus: false
        }
      );
    },
    [
      append
    ]
  );

  return (
    <div className="flex flex-col">
      {label && (
        <div className="flex items-center gap-2 px-1 pb-0.5 pt-1.5">
          <span className="truncate text-[0.6875rem] uppercase tracking-[0.08em] text-label/70">
            {label}
          </span>

          {fields.length > 0 && (
            <span className="text-[0.6875rem] tabular-nums text-label/50">
              {fields.length}
            </span>
          )}

          <AddLayerPopover
            onAdd={ handleAdd }
            ariaLabel={ `Add a layer to ${ label }` }
          />
        </div>
      )}

      {fields.length === 0 && (
        <p className="px-1 pb-1 text-label/60">
          No layers yet.
        </p>
      )}

      <DndContext
        collisionDetection={ closestCenter }
        onDragEnd={ handleDragEnd }
        sensors={ sensors }
        modifiers={ [
          restrictToVerticalAxis,
          restrictToParentElement
        ] }
      >
        <SortableContext items={ ids } strategy={ verticalListSortingStrategy }>
          {fields.map( (
            field, index
          ) => {
            const itemPath = `${ baseFieldName }.${ index }`;

            return (
              <SortableRow key={ field.id } id={ field.id }>
                {( dragBinder ) => (
                  <LayerRow
                    itemPath={ itemPath }
                    selected={ selectedPath === itemPath }
                    onSelect={ () => onSelect( itemPath ) }
                    onDuplicate={ () => duplicateItem( index ) }
                    onRemove={ () => remove( index ) }
                    dragBinder={ dragBinder }
                  />
                )}
              </SortableRow>
            );
          } )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
