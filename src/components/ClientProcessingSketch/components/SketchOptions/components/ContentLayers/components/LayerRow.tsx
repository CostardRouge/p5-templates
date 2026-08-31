"use client";

import React from "react";
import clsx from "clsx";
import {
  Copy, GripVertical, Trash2
} from "lucide-react";
import {
  useWatch, useFormContext
} from "react-hook-form";

import {
  ITEM_META
} from "../../ContentItems/components/AddItemControls/components/ItemPalette/constants/item-kinds";
import type {
  ItemKind
} from "../../ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";
import describeContentItem from "../../ContentItems/utils/describeContentItem";
import type {
  DragBinder
} from "../../SortableRow";

type LayerRowProps = {
  /** Form path of the item this row stands for, e.g. `slides.1.content.0`. */
  itemPath: string;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  dragBinder?: DragBinder;
};

const ROW_ACTION_CLASS =
  "rounded-md p-2 md:p-1 text-label transition-colors hover:bg-hover hover:text-foreground";

/**
 * One layer in the list: its type's icon, the name and preview derived by
 * describeContentItem, and the row actions. The row itself is the button that
 * opens the layer's inspector — the icons are the exceptions, and they stop
 * propagation so duplicating never also navigates.
 */
export default function LayerRow( {
  itemPath,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  dragBinder
}: LayerRowProps ) {
  const {
    control
  } = useFormContext();

  const item = useWatch( {
    control,
    name: itemPath
  } );

  const {
    label, preview
  } = describeContentItem( item );
  const type = ( item as {
    type?: ItemKind
  } | undefined )?.type;
  const Icon = type ? ITEM_META[ type ]?.Icon : undefined;

  return (
    <div
      className={ clsx(
        "group flex items-center gap-1 rounded-lg border pl-0.5 pr-1 transition-colors",
        selected
          ? "border-foreground/40 bg-hover"
          : "border-transparent hover:border-theme hover:bg-hover/60"
      ) }
      data-selected={ selected ? "true" : "false" }
    >
      {/* Drag handle only — the row is a button, so the whole row cannot also
          be the drag activator without swallowing the click that selects. */}
      <button
        type="button"
        ref={ dragBinder?.setHandleRef }
        { ...( dragBinder?.handleProps ?? {} ) }
        aria-label="Reorder layer"
        className={ clsx(
          "flex shrink-0 cursor-grab items-center justify-center rounded-md p-1.5 md:p-1 text-label/60 transition-colors hover:text-foreground active:cursor-grabbing",
          dragBinder?.isDragging && "cursor-grabbing"
        ) }
      >
        <GripVertical className="h-4 w-3.5" />
      </button>

      <button
        type="button"
        onClick={ onSelect }
        className="flex min-h-[2.25rem] min-w-0 flex-1 items-center gap-2 py-1 text-left md:min-h-0"
      >
        {Icon && (
          <Icon
            className="h-4 w-4 shrink-0 text-label md:h-3.5 md:w-3.5"
            strokeWidth={ 1.75 }
          />
        )}

        <span className="truncate text-foreground">{label}</span>

        {preview && (
          <span className="truncate text-label/70">{preview}</span>
        )}
      </button>

      {/* Kept out of the row button so a mis-aimed tap selects the layer
          instead of deleting it; revealed on hover, always reachable by
          keyboard. */}
      <div className="flex shrink-0 items-center gap-0.5 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={ ( event ) => {
            event.stopPropagation();
            onDuplicate();
          } }
          aria-label="Duplicate layer"
          className={ clsx(
            ROW_ACTION_CLASS,
            "cursor-copy"
          ) }
        >
          <Copy className="h-4 w-4 md:h-3.5 md:w-3.5" />
        </button>

        <button
          type="button"
          onClick={ ( event ) => {
            event.stopPropagation();
            onRemove();
          } }
          aria-label="Remove layer"
          className={ clsx(
            ROW_ACTION_CLASS,
            "hover:text-red-500"
          ) }
        >
          <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
        </button>
      </div>
    </div>
  );
}
