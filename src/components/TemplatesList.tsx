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
            } ) => (
              <HardLink
                key={name}
                href={href}
                className={
                  view === "grid"
                    ? "block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow hover:shadow-md transition"
                    : "flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                }
              >
                <span className="block text-ellipsis text-nowrap overflow-hidden font-medium">
                  {name}
                </span>
                {view === "list" && <span className="text-gray-500 dark:text-gray-400">➔</span>}
              </HardLink>
            ) )}
          </div>
        </div>
      ) )}
    </div>
  );
}
