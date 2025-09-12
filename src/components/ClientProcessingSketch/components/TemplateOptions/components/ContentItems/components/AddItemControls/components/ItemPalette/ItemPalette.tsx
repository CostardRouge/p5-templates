"use client";

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
const size = "h-3 w-3";

export default function ItemPalette( {
  onAdd,
  kinds = ITEM_ORDER,
  className = "",
}: Props ) {
  return (
    <div
      className={clsx(
        "grid grid-cols-5",
        gap,
        "rounded-sm border border-gray-200 hover:border-gray-300 bg-white p-0.5",
        className
      )}
      role="list"
      aria-label="Add item palette"
    >
      {kinds.map( ( kind ) => {
        const meta = ITEM_META[ kind ];

        return (
          <button
            key={kind}
            type="button"
            onClick={() => onAdd( kind )}
            className={clsx(
              "flex items-center justify-center",
              "rounded-sm border border-transparent p-1 transition",
              "hover:border-gray-300 hover:bg-gray-50 hover:shadow active:scale-[0.98]"
            )}
            role="listitem"
            aria-label={meta.label}
            title={meta.description ?? meta.label}
          >
            <meta.Icon className={size} strokeWidth={1.75} />
          </button>
        );
      } )}
    </div>
  );
}
