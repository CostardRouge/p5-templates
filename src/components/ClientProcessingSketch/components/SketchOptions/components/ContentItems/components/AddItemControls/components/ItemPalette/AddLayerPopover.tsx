"use client";

import React from "react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import {
  Plus
} from "lucide-react";

import ItemPalette from "./ItemPalette";
import SketchPickerDialog from "../../../SketchLayerPicker/SketchPickerDialog";
import {
  ITEM_GROUPS
} from "./constants/item-kinds";
import {
  AddItemHandler, ItemKind
} from "./types/item-kinds";
import {
  loadSketchForm, type SketchChoice
} from "@/lib/sketchLayerCatalogue";

type Props = {
  onAdd: AddItemHandler;
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
 *
 * One tile does not add immediately: "Sketch" needs to know WHICH sketch, so it
 * swaps the popover for the thumbnail picker and only then appends the layer,
 * seeded with the chosen sketch and its own defaults. Adding it blind would put
 * an empty rectangle in the list and make choosing a second step.
 */
export default function AddLayerPopover( {
  onAdd,
  ariaLabel,
  onOpen
}: Props ) {
  const [
    pickingSketch,
    setPickingSketch
  ] = React.useState( false );

  const handlePick = React.useCallback(
    ( choice: SketchChoice ) => {
      setPickingSketch( false );

      // The layer is added either way: a failed form fetch leaves it running
      // on the sketch's own code defaults, which is far better than swallowing
      // the press.
      loadSketchForm( choice.path )
        .then(
          ( form ) => form.formValues,
          () => ( {} )
        )
        .then( ( settings ) => onAdd(
          "sketch",
          {
            sketch: choice.path,
            settings
          }
        ) );
    },
    [
      onAdd
    ]
  );

  const handleAdd = React.useCallback(
    (
      kind: ItemKind, close: () => void
    ) => {
      close();

      if ( kind === "sketch" ) {
        setPickingSketch( true );
        return;
      }

      onAdd( kind );
    },
    [
      onAdd
    ]
  );

  return (
    <>
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
              onAdd={ ( kind ) => handleAdd(
                kind,
                close
              ) }
            />
          )}
        </PopoverPanel>
      </Popover>

      {/* Portalled to the body, so it outlives the popover that opened it. */}
      <SketchPickerDialog
        open={ pickingSketch }
        onPick={ handlePick }
        onClose={ () => setPickingSketch( false ) }
      />
    </>
  );
}
