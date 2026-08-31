"use client";

import React from "react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import {
  Plus
} from "lucide-react";

import ItemPalette from "./ItemPalette";
import {
  ITEM_GROUPS
} from "./constants/item-kinds";
import {
  ItemKind
} from "./types/item-kinds";

type Props = {
  onAdd: ( kind: ItemKind ) => void;
  /** Names where the layer lands, e.g. "Add a layer to this slide". */
  ariaLabel: string;
  /** Side effect on press — the hosts use it to unfold a shut band. */
  onOpen?: () => void;
};

/**
 * The `+` that opens the content-type palette as an anchored popover. The
 * palette used to unfold inline in the panel body, which stopped scaling once
 * the HUD widgets became content types of their own (seventeen tiles pushed
 * the layer rows off screen); the popover floats over the rail instead, per
 * the BindingAffordance precedent (portalled, so the scrollable rail never
 * clips it).
 */
export default function AddLayerPopover( {
  onAdd,
  ariaLabel,
  onOpen
}: Props ) {
  return (
    <Popover className="relative ml-auto shrink-0">
      <PopoverButton
        onClick={ onOpen }
        aria-label={ ariaLabel }
        title={ ariaLabel }
        className="rounded-md p-2 md:p-1 text-label transition-colors hover:bg-hover hover:text-foreground data-[open]:text-foreground"
      >
        <Plus className="h-4 w-4 md:h-3.5 md:w-3.5" />
      </PopoverButton>

      <PopoverPanel
        anchor="bottom end"
        className="z-[60] w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-theme bg-background p-2 text-xs shadow-xl [--anchor-gap:0.4rem] [--anchor-padding:0.5rem]"
      >
        {( {
          close
        }: { close: () => void } ) => (
          <ItemPalette
            groups={ ITEM_GROUPS }
            onAdd={ ( kind ) => {
              onAdd( kind );
              close();
            } }
          />
        )}
      </PopoverPanel>
    </Popover>
  );
}
