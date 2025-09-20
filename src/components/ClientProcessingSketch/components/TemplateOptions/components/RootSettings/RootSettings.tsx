"use client";

import React from "react";
import rootFormConfig from "./constants/root-field-config";

import GenericObjectForm from "./components/GenericObjectForm/GenericObjectForm";
import {
  ArrowDownFromLine, ListCollapse
} from "lucide-react";
import CollapsibleItem from "@/components/CollapsibleItem";

export default function RootSettings() {
  return (
    <CollapsibleItem
      initialExpandedValue={false}
      data-no-zoom=""
      className="p-1 border rounded-sm bg-white border-gray-300 text-black"
      header={( expanded ) => (
        <button
          className="text-gray-500 text-xs w-full text-left -ml-1"
          aria-label={expanded ? "Collapse controls" : "Expand controls"}
        >
          <ListCollapse
            className="inline text-gray-500 h-3 "
            style={{
              rotate: expanded ? "180deg" : "0deg"
            }}
          />
          <span>{expanded ? "hide" : "open"} root settings</span>
        </button>
      )}
    >

      <GenericObjectForm config={rootFormConfig} />
    </CollapsibleItem>
  );
}
