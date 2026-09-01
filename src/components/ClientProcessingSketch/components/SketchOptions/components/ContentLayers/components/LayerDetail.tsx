"use client";

import React from "react";
import clsx from "clsx";
import {
  ChevronLeft, Copy, Trash2
} from "lucide-react";
import {
  useFormContext, useWatch
} from "react-hook-form";

import useGlobalHotkey from "@/hooks/useGlobalHotkey";
import GenericItemForm from "../../ContentItems/components/GenericItemForm";
import {
  ITEM_META
} from "../../ContentItems/components/AddItemControls/components/ItemPalette/constants/item-kinds";
import type {
  ItemKind
} from "../../ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";
import describeContentItem from "../../ContentItems/utils/describeContentItem";
import useContentArray from "../../ContentArrayProvider/hooks/useContentArray";

type LayerDetailProps = {
  baseFieldName: "content" | `slides.${ number }.content`;
  index: number;
  onBack: () => void;
};

const DETAIL_ACTION_CLASS =
  "rounded-md p-2 md:p-1 text-label transition-colors hover:bg-hover hover:text-foreground";

/**
 * One layer's inspector, shown in place of the list.
 *
 * The header is the navigation: a back arrow, the layer's derived name, and
 * the two actions that belong to the layer as a whole. Everything below is the
 * item's own fields, rendered bare — the accordion the list used to stack is
 * gone, because the panel is now showing exactly one item on purpose.
 */
export default function LayerDetail( {
  baseFieldName,
  index,
  onBack
}: LayerDetailProps ) {
  const {
    control, getValues
  } = useFormContext();
  const {
    remove, insert
  } = useContentArray();

  const itemPath = `${ baseFieldName }.${ index }`;

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

  const handleDuplicate = () => {
    const current = getValues( itemPath );
    const clone = current ? JSON.parse( JSON.stringify( current ) ) : {};

    if ( clone && typeof clone === "object" && "id" in clone ) {
      delete ( clone as Record<string, unknown> ).id;
    }

    insert(
      index + 1,
      clone
    );
    // The duplicate takes the row below; stay on the list to see both.
    onBack();
  };

  const handleRemove = React.useCallback(
    () => {
      remove( index );
      onBack();
    },
    [
      remove,
      index,
      onBack
    ]
  );

  // Delete/Backspace removes the open (highlighted) layer, mirroring the
  // trash button. Routed through useGlobalHotkey so it shares the one guard
  // every other studio shortcut backs off for — text entry, buttons/ARIA
  // controls, open dialogs — instead of a second, narrower check.
  useGlobalHotkey( {
    code: "Delete",
    onTrigger: handleRemove
  } );
  useGlobalHotkey( {
    code: "Backspace",
    onTrigger: handleRemove
  } );

  // The item can vanish under the detail — deleted from the canvas, or the
  // slide switched while it was open. Falling back to the list beats rendering
  // a form bound to a path that no longer exists.
  if ( !item ) {
    return null;
  }

  return (
    <div className="flex flex-col text-xs">
      <div className="flex items-center gap-1 px-1 py-1">
        <button
          type="button"
          onClick={ onBack }
          aria-label="Back to layers"
          className={ clsx(
            DETAIL_ACTION_CLASS,
            "shrink-0"
          ) }
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {Icon && (
          <Icon
            className="h-4 w-4 shrink-0 text-label md:h-3.5 md:w-3.5"
            strokeWidth={ 1.75 }
          />
        )}

        <span className="truncate font-medium text-foreground">{label}</span>

        {preview && (
          <span className="truncate text-label/70">{preview}</span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={ handleDuplicate }
            aria-label="Duplicate layer"
            className={ clsx(
              DETAIL_ACTION_CLASS,
              "cursor-copy"
            ) }
          >
            <Copy className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </button>

          <button
            type="button"
            onClick={ handleRemove }
            aria-label="Remove layer"
            className={ clsx(
              DETAIL_ACTION_CLASS,
              "hover:text-red-500"
            ) }
          >
            <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-1 pb-1">
        <GenericItemForm baseFieldName={ baseFieldName } index={ index } />
      </div>
    </div>
  );
}
