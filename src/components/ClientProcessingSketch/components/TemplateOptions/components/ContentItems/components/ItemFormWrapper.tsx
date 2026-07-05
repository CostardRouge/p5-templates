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
import {
  useContentSelection
} from "@/components/ClientProcessingSketch/components/TemplateOptions/hooks/useContentItemSelection";

// Time (ms) to wait before scrolling, so the zone + item expand animations
// (CollapsibleItem's ~200ms grid transition) settle first. Matched to the
// pulse so the item is in view as the ring fires.
const REVEAL_SCROLL_DELAY_MS = 240;
// Slightly longer than the select-pulse animation (0.6s × 2) so the class is
// removed only after it finishes.
const REVEAL_PULSE_MS = 1300;

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

  // Reveal-on-canvas-select: when this item is the one pressed on the canvas,
  // scroll it into view and pulse its border (macOS menu-bar style).
  const selection = useContentSelection();
  const rootRef = React.useRef<HTMLDivElement>( null );
  const handledNonceRef = React.useRef( -1 );

  const [
    pulsing,
    setPulsing
  ] = React.useState( false );

  React.useEffect(
    () => {
      if (
        !selection ||
        !itemPath ||
        selection.path !== itemPath ||
        selection.nonce === handledNonceRef.current
      ) {
        return;
      }

      handledNonceRef.current = selection.nonce;
      setPulsing( true );

      const scrollTimer = setTimeout(
        () => {
          rootRef.current?.scrollIntoView( {
            block: "center",
            behavior: "smooth"
          } );
        },
        REVEAL_SCROLL_DELAY_MS
      );
      const pulseTimer = setTimeout(
        () => setPulsing( false ),
        REVEAL_PULSE_MS
      );

      return () => {
        clearTimeout( scrollTimer );
        clearTimeout( pulseTimer );
      };
    },
    [
      selection,
      itemPath
    ]
  );

  return (
    <CollapsibleItem
      rootRef={ rootRef }
      expanded={ expanded }
      onToggle={ collapsibleKey ? ( isExpanded ) => setExpanded(
        collapsibleKey,
        isExpanded
      ) : undefined }
      className={ clsx(
        "p-1 border border-theme rounded-lg bg-background",
        pulsing && "animate-select-pulse motion-reduce:animate-none"
      ) }
      header={ ( expanded ) => (
        <div
          ref={ dragBinder?.setHandleRef }
          { ...( dragBinder?.handleProps ?? {} ) }
          className={ clsx(
            "flex items-center gap-1 min-h-[2.5rem] md:min-h-0",
            {
              "mb-2": expanded,
              "active:cursor-grabbing": dragBinder?.isDragging
            }
          ) }
        >
          <h4 className="text-foreground bg-background px-1 rounded-xl">
            {itemType}
          </h4>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={ ( event ) => {
                event.stopPropagation();
                onDuplicate();
              } }
              aria-label="Duplicate item"
              className="cursor-copy rounded-md p-2 md:p-1 hover:bg-hover transition-colors"
            >
              <Copy className="h-4 w-4 md:h-3.5 md:w-3.5 text-foreground" />
            </button>

            <button
              type="button"
              onClick={ ( event ) => {
                event.stopPropagation();
                onRemove();
              } }
              aria-label="Remove layer"
              className="rounded-md p-2 md:p-1 hover:bg-hover transition-colors"
            >
              <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5 text-red-500" />
            </button>
          </div>
        </div>
      ) }
    >
      {children}
    </CollapsibleItem>
  );
}
