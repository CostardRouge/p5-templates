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

const gap = "gap-1";
const size = "h-4 w-4 md:h-3 md:w-3";

export default function ItemPalette( {
  onAdd,
  kinds = ITEM_ORDER,
  className = ""
}: Props ) {
  return (
    <div
      className={ clsx(
        "grid grid-cols-6",
        gap,
        "rounded-md border border-theme bg-background p-0.5 overflow-hidden",
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
              "flex items-center justify-center rounded",
              "min-h-[2.5rem] md:min-h-0 p-1 transition hover:bg-hover",
              "active:scale-[0.98]"
            ) }
            role="listitem"
            aria-label={ meta.label }
            title={ meta.description ?? meta.label }
          >
            <meta.Icon className={ size } strokeWidth={ 1.75 } />
          </button>
        );
      } )}
    </div>
  );
}
