"use client";

import React, {
  useEffect, useState
} from "react";
import {
  FileSliders, Grid, List, Search
} from "lucide-react";
import {
  TemplateCategory
} from "@/app/templates/page";
import {
  useRouter, useSearchParams
} from "next/navigation";

import HardLink from "@/components/HardLink";
import {
  usePersistedViewMode
} from "@/hooks/usePersistedViewMode";

interface TemplatesListProps {
  templates: Record<string, TemplateCategory>;
}

export default function TemplatesList( {
  templates
}: TemplatesListProps ) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [
    view,
    setView
  ] = usePersistedViewMode<"grid" | "list">(
    "templates-view-mode",
    "grid"
  );
  const [
    search,
    setSearch
  ] = useState<string>( searchParams.get( "keyword" ) || "" );

  // Update URL when search changes
  useEffect(
    () => {
      const params = new URLSearchParams( searchParams.toString() );

      if ( search ) {
        params.set(
          "keyword",
          search
        );
      } else {
        params.delete( "keyword" );
      }

      const newUrl = params.toString()
        ? `/templates?${ params.toString() }`
        : "/templates";

      router.replace(
        newUrl,
        {
          scroll: false,
        }
      );
    },
    [
      search,
      router,
      searchParams
    ]
  );

  // Filter templates based on search
  const filteredTemplates = Object.entries( templates ).reduce(
    (
      acc, [
        category,
        items
      ]
    ) => {
      const filtered = items.filter( ( item ) =>
        item.name.toLowerCase().includes( search.toLowerCase() ) ||
          ( item.category &&
            item.category.toLowerCase().includes( search.toLowerCase() ) ) );

      if ( filtered.length > 0 ) {
        acc[ category ] = filtered;
      }

      return acc;
    },
    {
    } as Record<string, TemplateCategory>
  );

  const totalCount = Object.values( filteredTemplates ).reduce(
    (
      sum, items
    ) => sum + items.length,
    0
  );

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Templates
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 mt-0.5 sm:mt-1">
            {totalCount} {totalCount === 1 ? "template" : "templates"}
            {search && ` matching "${ search }"`}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground/40" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={( e ) => setSearch( e.target.value )}
              className="pl-9 pr-3 py-2 sm:pl-11 sm:pr-4 sm:py-2.5 rounded-lg sm:rounded-xl w-full bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-xs sm:text-sm placeholder:text-foreground/40"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-background border border-border rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0">
            <button
              onClick={() => setView( "grid" )}
              className={`px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all duration-200 ${
                view === "grid"
                  ? "bg-hover text-foreground"
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
              }`}
              title="Grid view"
            >
              <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <div className="w-px h-5 sm:h-6 bg-border" />

            <button
              onClick={() => setView( "list" )}
              className={`px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all duration-200 ${
                view === "list"
                  ? "bg-hover text-foreground"
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {totalCount === 0 && (
        <div className="text-center py-8 sm:py-16">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-hover/50 mb-3 sm:mb-4">
            <Search className="w-6 h-6 sm:w-8 sm:h-8 text-foreground/40" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
            No templates found
          </h3>
          <p className="text-xs sm:text-sm text-foreground/60">
            Try adjusting your search term
          </p>
        </div>
      )}

      {/* Categories */}
      {Object.entries( filteredTemplates ).map( ( [
        category,
        items
      ] ) => {
        // Group items by their category field (for p5 sketches)
        const groupedItems: Record<string, typeof items> = {
        };
        const uncategorized: typeof items = [
        ];

        items.forEach( ( item ) => {
          if ( item.category ) {
            if ( !groupedItems[ item.category ] ) {
              groupedItems[ item.category ] = [
              ];
            }
            groupedItems[ item.category ].push( item );
          } else {
            uncategorized.push( item );
          }
        } );

        return (
          <div key={category} className="space-y-2 sm:space-y-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                {category}
              </h2>
              <span className="text-xs sm:text-sm text-foreground/50 font-medium">
                {items.length} {items.length === 1 ? "template" : "templates"}
              </span>
            </div>

            {/* Render categorized groups */}
            {Object.entries( groupedItems ).map( ( [
              subCategory,
              subItems
            ] ) => (
              <div key={subCategory} className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 pl-2 sm:pl-4">
                  <h3 className="text-sm sm:text-base font-medium text-foreground/80">
                    {subCategory}
                  </h3>
                  <span className="text-xs text-foreground/40">
                    {subItems.length}
                  </span>
                </div>

                <div
                  className={
                    view === "grid"
                      ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-4"
                      : "space-y-2 sm:space-y-3"
                  }
                >
                  {subItems.map( ( {
                    href, name, thumbnail, hasSketchForm
                  } ) => (
                    <TemplateCard
                      key={name}
                      href={href}
                      name={name}
                      thumbnail={thumbnail}
                      hasSketchForm={hasSketchForm}
                      view={view}
                    />
                  ) )}
                </div>
              </div>
            ) )}

            {/* Render uncategorized items */}
            {uncategorized.length > 0 && (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 pl-2 sm:pl-4">
                  <h3 className="text-sm sm:text-base font-medium text-foreground/80">
                    No category
                  </h3>
                  <span className="text-xs text-foreground/40">
                    {uncategorized.length}
                  </span>
                </div>

                <div
                  className={
                    view === "grid"
                      ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-4"
                      : "space-y-2 sm:space-y-3"
                  }
                >
                  {uncategorized.map( ( {
                    href, name, thumbnail, hasSketchForm
                  } ) => (
                    <TemplateCard
                      key={name}
                      href={href}
                      name={name}
                      thumbnail={thumbnail}
                      hasSketchForm={hasSketchForm}
                      view={view}
                    />
                  ) )}
                </div>
              </div>
            )}
          </div>
        );
      } )}
    </div>
  );
}

function TemplateCard( {
  href,
  name,
  thumbnail,
  hasSketchForm,
  view,
}: {
  href: string;
  name: string;
  thumbnail: string;
  hasSketchForm: boolean;
  view: "grid" | "list";
} ) {
  if ( view === "grid" ) {
    return (
      <HardLink
        href={href}
        className="group relative w-full bg-background rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-foreground/20 transition-all duration-300 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5"
      >
        {/* Aspect ratio box for 4:5 (360x450) */}
        <div
          className="w-full relative"
          style={{
            paddingTop: "125%",
          }}
        >
          {hasSketchForm && (
            <div
              className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10"
              title="Has a magic form"
            >
              <div className="bg-background/90 backdrop-blur-sm rounded-lg border border-border shadow-lg p-1 sm:p-1.5">
                <FileSliders className="w-3 h-3 sm:w-4 sm:h-4 text-foreground" />
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
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 shadow-lg">
            <p className="text-xs sm:text-sm font-medium text-foreground truncate text-center">
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
      href={href}
      className="group flex items-center gap-2 sm:gap-4 bg-background border border-border hover:border-foreground/20 rounded-xl sm:rounded-2xl p-2 sm:p-4 hover:bg-hover/50 transition-all duration-300 hover:shadow-md hover:shadow-foreground/5"
    >
      <div
        className="w-12 sm:w-16 flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden border border-border"
        style={{
          aspectRatio: "4 / 5",
        }}
      >
        <img
          alt={name}
          loading="lazy"
          src={thumbnail}
          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex-grow min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
          {name}
        </p>
      </div>

      {hasSketchForm && (
        <div className="flex-shrink-0" title="Has a magic form">
          <div className="bg-hover/50 rounded-lg border border-border p-1 sm:p-1.5">
            <FileSliders className="w-3 h-3 sm:w-4 sm:h-4 text-foreground" />
          </div>
        </div>
      )}

      <div className="flex-shrink-0 text-foreground/40 group-hover:text-foreground/60 transition-colors">
        <span className="text-xs sm:text-sm">→</span>
      </div>
    </HardLink>
  );
}
