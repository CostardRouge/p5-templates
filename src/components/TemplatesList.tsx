"use client";

import React, {
  useState
} from "react";
// import Link from "next/link";
import {
  Grid, List
} from "lucide-react";
import {
  TemplateCategory
} from "@/app/templates/page";

import HardLink from "@/components/HardLink";

interface TemplatesListProps {
  templates: Record<string, TemplateCategory>;
}

function getThumbnailURL( name: string ) {
  return `assets/scripts/p5-sketches/sketches/${ name }/thumbnail.jpeg`;
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
        <div>
          <h1 className="text-2xl font-semibold mb-4">Templates</h1>
        </div>

        <div className="flex items-center mb-2 space-x-2">
          <button
            aria-label="Grid view"
            onClick={() => setView( "grid" )}
            className={`p-2 rounded ${
              view === "grid" ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <Grid className="w-5 h-5"/>
          </button>
          <button
            aria-label="List view"
            onClick={() => setView( "list" )}
            className={`p-2 rounded ${
              view === "list" ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <List className="w-5 h-5"/>
          </button>
        </div>
      </div>

      {/* Categories */}
      {Object.entries( templates ).map( ( [
        category,
        items
      ] ) => (
        <div key={category} className="">
          <h2 className="text-lg font-medium mb-3">{category}</h2>
          <div
            className={
              view === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                : "space-y-2"
            }
          >
            {items.map( ( {
              href, name
            } ) => {
              if ( view === "grid" ) {
                return (
                  <HardLink
                    key={name}
                    href={href}
                    className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden shadow hover:shadow-md transition"
                  >
                    {/* Aspect ratio box for 4:5 (360x450) */}
                    <div className="w-full" style={{
                      paddingTop: "125%"
                    }}>
                      <img
                        alt={name}
                        loading="lazy"
                        src={getThumbnailURL( name )}
                        className="absolute top-0 left-0 w-full h-full object-contain"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/60 to-transparent">
                      <span className="text-white font-medium drop-shadow">
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
                  className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <div className="w-12 flex-shrink-0" style={{
                    aspectRatio: "4 / 5"
                  }}>
                    <img
                      alt={name}
                      loading="lazy"
                      src={getThumbnailURL( name )}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="flex-1 ml-3 truncate font-medium">{name}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">➔</span>
                </HardLink>
              );
            } )}
          </div>
        </div>
      ) )}
    </div>
  );
}
