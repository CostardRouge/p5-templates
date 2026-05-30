"use client";

import {
  ChevronDown, Grid, List, Search
} from "lucide-react";
import {
  useRouter, useSearchParams
} from "next/navigation";
import React, {
  useEffect, useState
} from "react";
import {
  flushSync
} from "react-dom";
import type {
  TemplateItem
} from "@/app/templates/getTemplatesData";

import Link from "@/components/HardLink";
import AnimatedPreview from "@/components/AnimatedPreview";
import AnimationsToggle from "@/components/AnimationsToggle";
import {
  MenuBarSlot
} from "@/components/MenuBarPortal";
import {
  usePersistedViewMode
} from "@/hooks/usePersistedViewMode";
import {
  useAnimationsEnabled
} from "@/hooks/useAnimationsEnabled";
import {
  useMarqueeOnHover
} from "@/hooks/useMarqueeOnHover";
import {
  usePersistedAccordion
} from "@/hooks/usePersistedAccordion";
import {
  fuzzyFilter
} from "@/utils/fuzzySearch";

const OTHER_SECTION = "__other__";
const PEEK_COUNT = 6;
const GRID_CLASS =
  "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-4";

function sectionId(
  engineId: string, category: string
) {
  return `${ engineId }::${ category }`;
}

function hasFeatured( items: TemplateItem[] ) {
  return items.some( ( item ) => !item.hiddenFromTemplates );
}

// Run a state update inside a View Transition when the browser supports it,
// so DOM changes (engine switch, section expand/collapse) cross-fade smoothly.
function runViewTransition( update: () => void ) {
  if ( typeof document !== "undefined" && "startViewTransition" in document ) {
    ( document as Document & { startViewTransition: ( cb: () => void ) => void } )
      .startViewTransition( update );
  } else {
    update();
  }
}

interface TemplatesListProps {
  templates: Record<string, TemplateItem[]>;
  engineLabels: Record<string, string>;
  activeEngine: string; // "all" | engine id
}

export default function TemplatesList( {
  templates,
  engineLabels,
  activeEngine
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
    animationsEnabled,
    setAnimationsEnabled,
    animationsHydrated
  ] = useAnimationsEnabled();
  const [
    search,
    setSearch
  ] = useState<string>( searchParams.get( "keyword" ) || "" );

  // Accordion open/closed state per category section, persisted across visits.
  // On first visit, sections containing "featured" (non-hidden) templates are
  // opened by default; everything else stays collapsed so no preview videos
  // mount until the user expands a section.
  const {
    isOpen: isSectionOpen,
    toggle: toggleSection
  } = usePersistedAccordion(
    "templates-accordion-open",
    () => {
      const ids: string[] = [];

      Object.entries( templates ).forEach( ( [
        engineId,
        items
      ] ) => {
        const byCategory: Record<string, TemplateItem[]> = {};
        const other: TemplateItem[] = [];

        items.forEach( ( item ) => {
          if ( item.category ) {
            ( byCategory[ item.category ] ||= [] ).push( item );
          } else {
            other.push( item );
          }
        } );

        Object.entries( byCategory ).forEach( ( [
          category,
          categoryItems
        ] ) => {
          if ( hasFeatured( categoryItems ) ) {
            ids.push( sectionId(
              engineId,
              category
            ) );
          }
        } );

        if ( other.length > 0 && hasFeatured( other ) ) {
          ids.push( sectionId(
            engineId,
            OTHER_SECTION
          ) );
        }
      } );

      return ids;
    }
  );

  // While a search is active, every matching section is force-expanded so
  // results are always visible regardless of stored state.
  const searchActive = search.trim().length > 0;

  // Expand/collapse a section with a smooth cross-fade.
  const handleToggleSection = ( id: string ) =>
    runViewTransition( () => flushSync( () => toggleSection( id ) ) );

  // Local engine state — updates instantly on click so the UI doesn't wait
  // on route navigation. The URL is kept in sync in the background.
  const [
    currentEngine,
    setCurrentEngine
  ] = useState<string>( activeEngine );

  // Sync local state when the prop changes (e.g. browser back/forward)
  useEffect(
    () => {
      setCurrentEngine( activeEngine );
    },
    [
      activeEngine
    ]
  );

  // Keep ?keyword= in sync with the search state
  useEffect(
    () => {
      const basePath =
        currentEngine === "all" ? "/templates" : `/templates/${ currentEngine }`;

      const newUrl = search
        ? `${ basePath }?keyword=${ encodeURIComponent( search ) }`
        : basePath;

      router.replace(
        newUrl,
        {
          scroll: false
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      search
    ]
  );

  // Switch engine tab: animate via View Transitions API, sync the URL in the background
  const handleEngineClick = ( engineId: string ) => {
    runViewTransition( () => flushSync( () => setCurrentEngine( engineId ) ) );

    const basePath =
      engineId === "all" ? "/templates" : `/templates/${ engineId }`;
    const suffix = search
      ? `?keyword=${ encodeURIComponent( search ) }`
      : "";

    router.push( `${ basePath }${ suffix }` );
  };

  // Fuzzy-filter templates per engine
  const filteredTemplates = Object.entries( templates ).reduce(
    (
      acc, [
        engineId,
        items
      ]
    ) => {
      const filtered = fuzzyFilter(
        items,
        search,
        ( item ) => [
          item.name,
          item.category || ""
        ]
      );

      if ( filtered.length > 0 ) {
        acc[ engineId ] = filtered;
      }

      return acc;
    },
    {} as Record<string, TemplateItem[]>
  );

  // Narrow to the selected engine tab (or keep all)
  const displayedTemplates =
    currentEngine === "all"
      ? filteredTemplates
      : Object.fromEntries( Object.entries( filteredTemplates ).filter( ( [
        id
      ] ) => id === currentEngine ) );

  const totalCount = Object.values( displayedTemplates ).reduce(
    (
      sum, items
    ) => sum + items.length,
    0
  );

  const engineOrder = Object.keys( templates ).sort( (
    a, b
  ) => ( templates[ b ]?.length ?? 0 ) - ( templates[ a ]?.length ?? 0 ) );

  const totalAllCount = Object.values( templates ).reduce(
    (
      sum, items
    ) => sum + items.length,
    0
  );

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MenuBarSlot />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">
              Templates
            </h1>
          </div>
          <AnimationsToggle
            enabled={ animationsEnabled }
            onChange={ setAnimationsEnabled }
            disabled={ !animationsHydrated }
          />
        </div>

        <div className="flex items-center gap-2 w-full">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground/40" />
            <input
              type="text"
              placeholder="Search templates..."
              value={ search }
              onChange={ ( e ) => setSearch( e.target.value ) }
              className="pl-9 pr-3 py-2 sm:pl-11 sm:pr-4 sm:py-2.5 rounded-lg sm:rounded-xl w-full bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-xs sm:text-sm placeholder:text-foreground/40"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-background border border-border rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0">
            <button
              onClick={ () => setView( "grid" ) }
              className={ `px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all duration-200 ${
                view === "grid"
                  ? "bg-hover text-foreground"
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
              }` }
              title="Grid view"
            >
              <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <div className="w-px h-5 sm:h-6 bg-border" />

            <button
              onClick={ () => setView( "list" ) }
              className={ `px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all duration-200 ${
                view === "list"
                  ? "bg-hover text-foreground"
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
              }` }
              title="List view"
            >
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Engine Tabs */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {/* All engines tab */}
          <button
            onClick={ () => handleEngineClick( "all" ) }
            className={ `flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
              currentEngine === "all"
                ? "bg-foreground text-background"
                : "bg-background border border-border text-foreground/60 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50"
            }` }
          >
            All engines
            <span
              className={ `text-xs px-1.5 py-0.5 rounded-md font-mono ${
                currentEngine === "all"
                  ? "bg-background/20 text-background/80"
                  : "bg-hover text-foreground/50"
              }` }
            >
              { totalAllCount }
            </span>
          </button>

          {/* Per-engine tabs */}
          { engineOrder.map( ( engineId ) => {
            const label = engineLabels[ engineId ] || engineId;
            const count = templates[ engineId ]?.length || 0;
            const isActive = currentEngine === engineId;

            return (
              <button
                key={ engineId }
                onClick={ () => handleEngineClick( engineId ) }
                className={ `flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-background border border-border text-foreground/60 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50"
                }` }
              >
                { label }
                <span
                  className={ `text-xs px-1.5 py-0.5 rounded-md font-mono ${
                    isActive
                      ? "bg-background/20 text-background/80"
                      : "bg-hover text-foreground/50"
                  }` }
                >
                  { count }
                </span>
              </button>
            );
          } ) }
        </div>
      </div>

      {/* Templates content — view-transition-name scopes the VT animation to this area only */}
      <div style={ {
        viewTransitionName: "templates-list"
      } }>

        {/* Empty State */}
        { totalCount === 0 && (
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
        ) }

        {/* Templates grouped by engine */}
        { Object.entries( displayedTemplates )
          .sort( (
            [
              a
            ], [
              b
            ]
          ) => engineOrder.indexOf( a ) - engineOrder.indexOf( b ) )
          .map( ( [
            engineId,
            items
          ] ) => {
            const label = engineLabels[ engineId ] || engineId;

            const groupedItems: Record<string, typeof items> = {};
            const uncategorized: typeof items = [];

            items.forEach( ( item ) => {
              if ( item.category ) {
                if ( !groupedItems[ item.category ] ) {
                  groupedItems[ item.category ] = [];
                }

                groupedItems[ item.category ].push( item );
              } else {
                uncategorized.push( item );
              }
            } );

            const hasCategoryGroups = Object.keys( groupedItems ).length > 0;

            return (
              <div key={ engineId } className="space-y-2 sm:space-y-4">
                {/* Engine section header — only in "All engines" view */}
                { currentEngine === "all" && (
                  <div className="flex items-center gap-2 sm:gap-3 pt-1">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground">
                      { label }
                    </h2>
                    <span className="text-xs sm:text-sm text-foreground/50 font-medium">
                      { items.length }{ " " }
                      { items.length === 1 ? "template" : "templates" }
                      { search && ` matching "${ search }"` }
                    </span>
                  </div>
                ) }

                {/* Categorized groups — each is a collapsible section */}
                { Object.entries( groupedItems ).map( ( [
                  subCategory,
                  subItems
                ] ) => {
                  const id = sectionId(
                    engineId,
                    subCategory
                  );

                  return (
                    <CollapsibleSection
                      key={ subCategory }
                      title={ subCategory }
                      count={ subItems.length }
                      open={ searchActive || isSectionOpen( id ) }
                      onToggle={ () => handleToggleSection( id ) }
                      items={ subItems }
                      view={ view }
                      animationsEnabled={ animationsEnabled }
                    />
                  );
                } ) }

                {/* Uncategorized items */}
                { uncategorized.length > 0 && (
                  hasCategoryGroups ? (
                    <CollapsibleSection
                      title={ `Other ${ label } templates` }
                      count={ uncategorized.length }
                      open={ searchActive || isSectionOpen( sectionId(
                        engineId,
                        OTHER_SECTION
                      ) ) }
                      onToggle={ () => handleToggleSection( sectionId(
                        engineId,
                        OTHER_SECTION
                      ) ) }
                      items={ uncategorized }
                      view={ view }
                      animationsEnabled={ animationsEnabled }
                    />
                  ) : (
                    // No category groups for this engine — render the grid
                    // directly without a collapsible header to collapse against.
                    <div className={ view === "grid" ? GRID_CLASS : "space-y-2 sm:space-y-3" }>
                      { uncategorized.map( (
                        {
                          href, name, thumbnail, preview, hasSketchForm, hiddenFromTemplates
                        }, index
                      ) => (
                        <TemplateCard
                          key={ name }
                          href={ href }
                          name={ name }
                          thumbnail={ thumbnail }
                          preview={ preview }
                          hasSketchForm={ hasSketchForm }
                          hiddenFromTemplates={ hiddenFromTemplates }
                          view={ view }
                          eager={ index === 0 }
                          animationsEnabled={ animationsEnabled }
                        />
                      ) ) }
                    </div>
                  )
                ) }
              </div>
            );
          } ) }
      </div>
    </div>
  );
}

function CollapsibleSection( {
  title,
  count,
  open,
  onToggle,
  items,
  view,
  animationsEnabled
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  items: TemplateItem[];
  view: "grid" | "list";
  animationsEnabled?: boolean;
} ) {
  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Header — toggles the section */}
      <button
        type="button"
        onClick={ onToggle }
        aria-expanded={ open }
        className="group/section flex items-center gap-2 pl-2 sm:pl-4 w-full text-left"
      >
        <ChevronDown
          className={ `w-3.5 h-3.5 text-foreground/50 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }` }
        />
        <h3 className="text-sm sm:text-base font-medium text-foreground/80 group-hover/section:text-foreground transition-colors">
          { title }
        </h3>
        <span className="text-xs text-foreground/60">
          { count }
        </span>
      </button>

      { open ? (
        <div className={ view === "grid" ? GRID_CLASS : "space-y-2 sm:space-y-3" }>
          { items.map( (
            item, index
          ) => (
            <TemplateCard
              key={ item.name }
              href={ item.href }
              name={ item.name }
              thumbnail={ item.thumbnail }
              preview={ item.preview }
              hasSketchForm={ item.hasSketchForm }
              hiddenFromTemplates={ item.hiddenFromTemplates }
              view={ view }
              eager={ index === 0 }
              animationsEnabled={ animationsEnabled }
            />
          ) ) }
        </div>
      ) : (
        // Collapsed peek row — lightweight static thumbnails only, no video
        // previews are mounted while the section stays closed.
        <button
          type="button"
          onClick={ onToggle }
          aria-label={ `Expand ${ title }` }
          className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-4 w-full overflow-hidden"
        >
          { items.slice(
            0,
            PEEK_COUNT
          ).map( ( item ) => (
            <span
              key={ item.name }
              className="w-10 sm:w-12 aspect-[4/5] flex-shrink-0 rounded-md sm:rounded-lg overflow-hidden border border-border bg-background opacity-90 hover:opacity-100 transition-opacity"
            >
              <Thumbnail
                src={ item.thumbnail }
                alt={ item.name }
                className="w-full h-full object-cover"
              />
            </span>
          ) ) }
          { items.length > PEEK_COUNT && (
            <span className="text-xs text-foreground/50 font-mono pl-1 flex-shrink-0">
              +{ items.length - PEEK_COUNT }
            </span>
          ) }
        </button>
      ) }
    </div>
  );
}

function TemplateCard( {
  href,
  name,
  thumbnail,
  preview,
  hiddenFromTemplates = false,
  view,
  eager = false,
  animationsEnabled
}: {
  href: string;
  name: string;
  thumbnail: string;
  preview: string | null;
  hasSketchForm: boolean;
  hiddenFromTemplates?: boolean;
  view: "grid" | "list";
  eager?: boolean;
  animationsEnabled?: boolean;
} ) {
  const {
    ref: nameRef,
    onMouseEnter: handleNameEnter,
    onMouseLeave: handleNameLeave,
    isActive: marqueeActive,
    style: marqueeStyle
  } = useMarqueeOnHover<HTMLParagraphElement>();

  if ( view === "grid" ) {
    return (
      <Link
        href={ href }
        className={ `group relative w-full bg-background rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-foreground/20 transition-all duration-300 hover:shadow-lg hover:shadow-active/10 hover:-translate-y-0.5 ${
          hiddenFromTemplates ? "opacity-40 grayscale hover:opacity-100 hover:grayscale-0" : ""
        }` }
      >
        { hiddenFromTemplates ? (
          <span className="absolute top-2 right-2 z-20 font-mono text-[9px] uppercase tracking-[0.18em] bg-foreground text-background px-1.5 py-0.5 rounded-sm pointer-events-none">
            hidden
          </span>
        ) : null }
        {/* Aspect ratio box for 4:5 (360x450) */}
        <div
          className="w-full relative"
          style={ {
            paddingTop: "125%"
          } }
        >
          {/* { hasSketchForm && (*/}
          {/*  <div*/}
          {/*    className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10"*/}
          {/*    title="Has a magic form"*/}
          {/*  >*/}
          {/*    <div className="bg-background/90 backdrop-blur-sm rounded-lg border border-border shadow-lg p-1 sm:p-1.5">*/}
          {/*      <FileSliders className="w-3 h-3 sm:w-4 sm:h-4 text-foreground" />*/}
          {/*    </div>*/}
          {/*  </div>*/}
          {/* ) }*/}

          { preview ? (
            <AnimatedPreview
              previewUrl={ preview }
              thumbnailUrl={ thumbnail }
              name={ name }
              eager={ eager }
              animationsEnabled={ animationsEnabled }
              imgClassName="w-full h-full object-contain transition-transform duration-300"
            />
          ) : (
            <Thumbnail
              src={ thumbnail }
              alt={ name }
              eager={ eager }
              className="absolute top-0 left-0 w-full h-full object-contain transition-transform duration-300"
            />
          ) }
        </div>

        {/* Template name */}
        <div
          className="bg-background border-t border-border px-1 py-2 overflow-hidden"
          onMouseEnter={ handleNameEnter }
          onMouseLeave={ handleNameLeave }
        >
          <p
            ref={ nameRef }
            title={ name }
            className={ `text-xs sm:text-sm font-medium text-foreground text-center whitespace-nowrap ${
              marqueeActive
                ? "overflow-visible animate-marquee-hover"
                : "overflow-hidden text-ellipsis"
            }` }
            style={ marqueeStyle }
          >
            { name }
          </p>
        </div>
      </Link>
    );
  }

  // list view
  return (
    <Link
      href={ href }
      className={ `group flex items-center gap-2 sm:gap-4 bg-background border border-border hover:border-foreground/20 rounded-xl sm:rounded-2xl p-2 sm:p-4 hover:bg-hover/50 transition-all duration-300 hover:shadow-md hover:shadow-foreground/5 ${
        hiddenFromTemplates ? "opacity-40 grayscale hover:opacity-100 hover:grayscale-0" : ""
      }` }
    >
      <div
        className="w-12 sm:w-16 aspect-[4/5] flex-shrink-0 relative rounded-lg sm:rounded-xl overflow-hidden border border-border"
      >
        { preview ? (
          <AnimatedPreview
            previewUrl={ preview }
            thumbnailUrl={ thumbnail }
            name={ name }
            eager={ eager }
            animationsEnabled={ animationsEnabled }
            imgClassName="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Thumbnail
            src={ thumbnail }
            alt={ name }
            eager={ eager }
            className="absolute top-0 left-0 w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) }
      </div>

      <div className="flex-grow min-w-0 flex items-center gap-2">
        <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
          { name }
        </p>
        { hiddenFromTemplates ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] bg-foreground text-background px-1.5 py-0.5 rounded-sm flex-shrink-0">
            hidden
          </span>
        ) : null }
      </div>

      {/* { hasSketchForm && (*/}
      {/*  <div className="flex-shrink-0" title="Has a magic form">*/}
      {/*    <div className="bg-hover/50 rounded-lg border border-border p-1 sm:p-1.5">*/}
      {/*      <FileSliders className="w-3 h-3 sm:w-4 sm:h-4 text-foreground" />*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/* ) }*/}

      <div className="flex-shrink-0 text-foreground/40 group-hover:text-foreground/60 transition-colors">
        <span className="text-xs sm:text-sm">→</span>
      </div>
    </Link>
  );
}

function Thumbnail( {
  src,
  alt,
  eager = false,
  className
}: {
  src: string;
  alt: string;
  eager?: boolean;
  className?: string;
} ) {
  const src2x = src.replace(
    /\.webp$/,
    "-2x.webp"
  );

  return (
    <img
      alt={ alt }
      src={ src }
      srcSet={ `${ src } 1x, ${ src2x } 2x` }
      width={ 360 }
      height={ 450 }
      loading={ eager ? "eager" : "lazy" }
      fetchPriority={ eager ? "high" : undefined }
      decoding={ eager ? "sync" : "async" }
      className={ className }
    />
  );
}
