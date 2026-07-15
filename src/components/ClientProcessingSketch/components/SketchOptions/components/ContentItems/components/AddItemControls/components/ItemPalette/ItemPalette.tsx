import * as React from "react";

import {
  ITEM_META, ITEM_ORDER
} from "./constants/item-kinds";

import {
  ItemKind
} from "./types/item-kinds";
import clsx from "clsx";

type Props = {
  onAdd: ( kind: ItemKind ) => void;
  kinds?: ItemKind[];
  className?: string;
};

/**
 * The palette of content-item types. Each type is a labeled tile (icon + name)
 * laid out three per row, so kinds that share a family of icons (specs, hud,
 * meta…) stay easy to tell apart at a glance.
 */
export default function ItemPalette( {
  onAdd,
  kinds = ITEM_ORDER,
  className = ""
}: Props ) {
  return (
    <div
      className={ clsx(
        "grid grid-cols-3 gap-1",
        className
      ) }
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
