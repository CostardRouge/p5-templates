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
    <div className="space-y-8">
      {/* View Toggle */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>

        <div className="h-8">
          <button
            onClick={() => setView( "grid" )}
            className={`rounded-l-xl border border-theme  border-r-0 h-full p-2 transition-colors ${ view === "grid" ? "bg-hover" : "hover:bg-hover" }`}
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setView( "list" )}
            className={`rounded-r-xl border border-theme  border-l-0 h-full p-2 transition-colors ${ view === "list" ? "bg-hover" : "hover:bg-hover" }`}
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
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{category}</h2>
            <span className="text-sm text-foreground/50 font-medium">
              {items.length} {items.length === 1 ? "template" : "templates"}
            </span>
          </div>
          
          <div
            className={
              view === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4"
                : "space-y-3"
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
                    className="group relative w-full bg-background rounded-2xl overflow-hidden border border-border hover:border-foreground/20 transition-all duration-300 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5"
                  >
                    {/* Aspect ratio box for 4:5 (360x450) */}
                    <div className="w-full relative" style={{
                      paddingTop: "125%"
                    }}>
                      { hasSketchForm && (
                        <div className="absolute top-3 left-3 z-10" title="Has a magic form">
                          <div className="bg-background/90 backdrop-blur-sm rounded-lg border border-border shadow-lg p-1.5">
                            <FileSliders className="w-4 h-4 text-foreground" />
                          </div>
                        </div>
                      )}
                      <img
                        alt={name}
                        loading="lazy"
                        src={thumbnail}
                        className="absolute top-0 left-0 w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    
                    {/* Template name */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl px-3 py-2 shadow-lg">
                        <p className="text-sm font-medium text-foreground truncate text-center">
                          {name}
                        </p>
                      </div>
                    </div>
                  </HardLink>
                );
              }
              
              // list view
              return (
                <HardLink
                  key={name}
                  href={href}
                  className="group flex items-center gap-4 bg-background border border-border hover:border-foreground/20 rounded-2xl p-4 hover:bg-hover/50 transition-all duration-300 hover:shadow-md hover:shadow-foreground/5"
                >
                  <div className="w-16 flex-shrink-0 rounded-xl overflow-hidden border border-border" style={{
                    aspectRatio: "4 / 5"
                  }}>
                    <img
                      alt={name}
                      loading="lazy"
                      src={thumbnail}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {name}
                    </p>
                  </div>
                  
                  { hasSketchForm && (
                    <div className="flex-shrink-0" title="Has a magic form">
                      <div className="bg-hover/50 rounded-lg border border-border p-1.5">
                        <FileSliders className="w-4 h-4 text-foreground" />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-shrink-0 text-foreground/40 group-hover:text-foreground/60 transition-colors">
                    <span className="text-sm">→</span>
                  </div>
                </HardLink>
              );
            } )}
          </div>
        </div>
      ) )}
    </div>
  );
}
