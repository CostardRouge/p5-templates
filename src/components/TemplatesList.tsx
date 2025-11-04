"use client";

import React, {
  useState
} from "react";
import {
  FileSliders, Grid, List
} from "lucide-react";
import {
  TemplateCategory
} from "@/app/templates/page";

import HardLink from "@/components/HardLink";

interface TemplatesListProps {
  templates: Record<string, TemplateCategory>;
}

export default function TemplatesList( {
  templates
}: TemplatesListProps ) {
  const [
    view,
    setView
  ] = useState<"grid" | "list">( "grid" );

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>

        <div className="h-8">
          <button
            onClick={() => setView( "grid" )}
            className={`rounded-l-xl border border-theme border-b-2 border-r-0 h-full p-2 ${ view === "grid" ? "bg-hover" : "hover:bg-hover" }`}
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setView( "list" )}
            className={`rounded-r-xl border border-theme border-b-2 border-l-0 h-full p-2 ${ view === "list" ? "bg-hover" : "hover:bg-hover" }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Categories */}
      {Object.entries( templates ).map( ( [
        category,
        items
      ] ) => (
        <div key={category}>
          <h2 className="text-lg font-medium mb-3">{category} ({items.length})</h2>
          <div
            className={
              view === "grid"
                ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2"
                : "space-y-2"
            }
          >
            {items.map( ( {
              href, name, thumbnail, hasSketchForm
            } ) => {
              if ( view === "grid" ) {
                return (
                  <HardLink
                    key={name}
                    href={href}
                    className="relative w-full bg-background rounded-xl overflow-hidden border border-theme transition"
                  >
                    {/* Aspect ratio box for 4:5 (360x450) */}
                    <div className="w-full" style={{
                      paddingTop: "125%"
                    }}>
                      { hasSketchForm && (
                        <span title="Has a magic form">
                          <FileSliders
                            className="w-6 absolute top-1 left-1 text-foreground bg-background rounded-lg py-1 px-1 z-10 border border-theme"
                          />
                        </span>
                      )}
                      <img
                        alt={name}
                        loading="lazy"
                        src={thumbnail}
                        className="absolute top-0 left-0 w-full h-full object-contain"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 w-full p-1">
                      <span className="text-foreground bg-background border border-theme rounded-lg text-sm px-2 text-center inline-block w-full">
                        {name}
                      </span>
                    </div>
                  </HardLink>
                );
              }
              // list view
              return (
                <HardLink
                  key={name}
                  href={href}
                  className="flex items-center bg-background border border-theme rounded-xl p-1 hover:bg-hover transition"
                >
                  <div className="w-12 flex-shrink-0" style={{
                    aspectRatio: "4 / 5"
                  }}>
                    <img
                      alt={name}
                      loading="lazy"
                      src={thumbnail}
                      className="w-full h-full object-contain rounded-lg border border-theme"
                    />
                  </div>

                  <span className="ml-3 truncate flex-grow">
                    <span>{name}</span>
                    <span className="text-foreground text-xs float-right">
                      { hasSketchForm && (
                        <span title="Has a magic form">
                          <FileSliders
                            className="w-6 text-foreground inline mr-1 bg-background rounded-lg py-1 px-1 border border-theme"
                          />
                        </span>
                      )}
                    </span>
                  </span>
                </HardLink>
              );
            } )}
          </div>
        </div>
      ) )}
    </div>
  );
}
