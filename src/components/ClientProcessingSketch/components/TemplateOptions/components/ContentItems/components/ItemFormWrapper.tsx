import React from "react";
import {
  Copy, Trash2
} from "lucide-react";
import CollapsibleItem from "@/components/CollapsibleItem";
import clsx from "clsx";
import {
  DragBinder
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/ContentItems";
import {
  useCollapsibleContext
} from "@/components/ClientProcessingSketch/components/TemplateOptions/hooks/useCollapsibleStates";

export type ItemFormWrapperProps = {
  itemType: string;
  onRemove: () => void;
  onDuplicate: () => void;
  children: React.ReactNode;
  dragBinder?: DragBinder;
  itemPath?: string;
};

export default function ItemFormWrapper( {
  onRemove,
  onDuplicate,
  children,
  itemType,
  dragBinder,
  itemPath
}: ItemFormWrapperProps ) {
  const {
    getExpanded, setExpanded
  } = useCollapsibleContext();
  const collapsibleKey = itemPath ? `item-${ itemPath }` : undefined;
  const expanded = collapsibleKey ? getExpanded(
    collapsibleKey,
    false
  ) : undefined;

  return (
    <CollapsibleItem
      expanded={ expanded }
      onToggle={ collapsibleKey ? ( isExpanded ) => setExpanded(
        collapsibleKey,
        isExpanded
      ) : undefined }
      className="p-1 border border-theme rounded-lg bg-background "
      header={ ( expanded ) => (
        <div
          ref={ dragBinder?.setHandleRef }
          { ...( dragBinder?.handleProps ?? {} ) }
          className={ clsx(
            "flex items-center",
            {
              "mb-2": expanded,
              "active:cursor-grabbing": dragBinder?.isDragging
            }
          ) }
        >
          <h4 className="text-foreground bg-background px-1 rounded-xl">
            {itemType}
          </h4>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={ ( event ) => {
                event.stopPropagation();
                onDuplicate();
              } }
              aria-label="Duplicate item"
              className="cursor-copy"
            >
              <Copy className="h-3.5 w-3.5 text-foreground" />
            </button>

            <button type="button" onClick={ onRemove } aria-label="Remove layer">
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </button>
          </div>
        </div>
      ) }
    >
      {children}
    </CollapsibleItem>
  );
}
