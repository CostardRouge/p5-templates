"use client";

import React from "react";
import rootFormConfig from "./constants/root-field-config";

import GenericObjectForm from "./components/GenericObjectForm/GenericObjectForm";
import {
  ListCollapse
} from "lucide-react";
import CollapsibleItem from "@/components/CollapsibleItem";

export default function RootSettings() {
  return (
    <CollapsibleItem
      initialExpandedValue={false}
      className="p-1 border border-theme rounded-xl text-foreground bg-background overflow-y-auto"
      headerContainerClassName="leading-none"
      header={( expanded ) => (
        <button
          className="text-foreground text-xs w-full text-left -ml-1 align-text-top"
          aria-label={expanded ? "Collapse controls" : "Expand controls"}
        >
          <ListCollapse
            className="inline text-foreground h-3"
            style={{
              rotate: expanded ? "180deg" : "0deg"
            }}
          />
          <span>general settings</span>
        </button>
      )}
    >
      <GenericObjectForm config={rootFormConfig} />
    </CollapsibleItem>
  );
}
