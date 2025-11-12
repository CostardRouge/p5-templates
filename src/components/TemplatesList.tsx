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
  ] = useState<"grid" | "list">( "grid" );
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
      
      const newUrl = params.toString() ? `/templates?${ params.toString() }` : "/templates";
      router.replace(
        newUrl,
        {
          scroll: false
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
  const filteredTemplates = Object.entries( templates ).reduce( (
    acc, [
      category,
      items
    ]
  ) => {
    const filtered = items.filter( item => 
      item.name.toLowerCase().includes( search.toLowerCase() )
    );
    
    if ( filtered.length > 0 ) {
      acc[ category ] = filtered;
    }
    
    return acc;
  }, {} as Record<string, TemplateCategory> );

  const totalCount = Object.values( filteredTemplates ).reduce( (
    sum, items
  ) => sum + items.length, 0 );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates</h1>
          <p className="text-sm text-foreground/60 mt-1">
            {totalCount} {totalCount === 1 ? "template" : "templates"}
            {search && ` matching "${search}"`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={( e ) => setSearch( e.target.value )}
              className="pl-10 pr-4 py-2.5 rounded-xl w-full sm:w-56 bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm placeholder:text-foreground/40"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-background border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setView( "grid" )}
              className={`px-3 py-2.5 transition-all duration-200 ${ 
                view === "grid" 
                  ? "bg-hover text-foreground" 
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50" 
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-border" />

            <button
              onClick={() => setView( "list" )}
              className={`px-3 py-2.5 transition-all duration-200 ${ 
                view === "list" 
                  ? "bg-hover text-foreground" 
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50" 
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {totalCount === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-hover/50 mb-4">
            <Search className="w-8 h-8 text-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No templates found</h3>
          <p className="text-sm text-foreground/60">
            Try adjusting your search term
          </p>
        </div>
      )}

      {/* Categories */}
      {Object.entries( filteredTemplates ).map( ( [
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
