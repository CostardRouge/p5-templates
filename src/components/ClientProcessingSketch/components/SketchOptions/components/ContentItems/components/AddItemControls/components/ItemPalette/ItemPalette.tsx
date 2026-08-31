import * as React from "react";

import {
  ITEM_META, ITEM_ORDER
} from "./constants/item-kinds";

import {
  AddItemHandler, ItemKind, ItemKindGroup
} from "./types/item-kinds";
import clsx from "clsx";

type Props = {
  onAdd: AddItemHandler;
  kinds?: ItemKind[];
  /** Labelled sections (Content / HUD…) — takes precedence over `kinds`. */
  groups?: ItemKindGroup[];
  className?: string;
};

function PaletteGrid( {
  kinds,
  onAdd
}: {
  kinds: ItemKind[];
  onAdd: AddItemHandler;
} ) {
  return (
    <div
      className="grid grid-cols-3 gap-1"
      role="list"
      aria-label="Add item palette"
    >
      {kinds.map( ( kind ) => {
        const meta = ITEM_META[ kind ];

        return (
          <button
            key={ kind }
            type="button"
            onClick={ () => onAdd( kind ) }
            className={ clsx(
              "group flex min-h-[3.25rem] flex-col items-center justify-center gap-1",
              "rounded-lg border border-theme bg-background px-1 py-1.5 text-center",
              "transition hover:bg-hover hover:border-foreground/20 active:scale-[0.98]"
            ) }
            role="listitem"
            aria-label={ meta.label }
            title={ meta.description ?? meta.label }
          >
            <meta.Icon
              className="h-4 w-4 shrink-0 text-foreground/70 transition-colors group-hover:text-foreground"
              strokeWidth={ 1.75 }
            />
            <span className="text-[11px] leading-tight text-foreground/80 transition-colors group-hover:text-foreground">
              {meta.label}
            </span>
          </button>
        );
      } )}
    </div>
  );
}

/**
 * The palette of content-item types. Each type is a labeled tile (icon + name)
 * laid out three per row, so kinds that share a family of icons (specs, the
 * HUD widgets, meta…) stay easy to tell apart at a glance. With `groups`, the
 * tiles split into labelled sections — seventeen flat tiles read as a wall.
 */
export default function ItemPalette( {
  onAdd,
  kinds = ITEM_ORDER,
  groups,
  className = ""
}: Props ) {
  if ( groups ) {
    return (
      <div
        className={ clsx(
          "flex flex-col gap-2",
          className
        ) }
      >
        {groups.map( ( group ) => (
          <div key={ group.label } className="flex flex-col gap-1">
            <span className="px-0.5 text-[0.6875rem] uppercase tracking-[0.08em] text-label/70">
              {group.label}
            </span>
            <PaletteGrid kinds={ group.kinds } onAdd={ onAdd } />
          </div>
        ) )}
      </div>
    );
  }

  return (
    <div className={ className }>
      <PaletteGrid kinds={ kinds } onAdd={ onAdd } />
    </div>
  );
}
