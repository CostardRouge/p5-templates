"use client";

import * as React from "react";

import ItemPalette from "./components/ItemPalette/ItemPalette";

import {
  ItemKind
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentLayerListForm/components/AddItemControls/components/ItemPalette/types/item-kinds";

import makeDefaultItem from "./components/ItemPalette/utils/makeDefaultItem";
import useContentArray
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentArrayProvider/hooks/useContentArray";

export default function AddItemControls() {
  const {
    append
  } = useContentArray();

  const handleAdd = React.useCallback(
    ( kind: ItemKind ) => {
      append(
        makeDefaultItem( kind ),
        {
          shouldFocus: false
        }
      );
    },
    [
      append
    ]
  );

  return <ItemPalette onAdd={handleAdd} />;
}
