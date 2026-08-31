"use client";

import {
  ChevronDown, FileUp, Grid, List, Search, X
} from "lucide-react";
import {
  useRouter, useSearchParams
} from "next/navigation";
import React, {
  useEffect, useRef, useState
} from "react";
import {
  flushSync
} from "react-dom";
import type {
  SketchItem
} from "@/app/sketches/getSketchesData";

import Link from "next/link";
import AnimatedPreview from "@/components/AnimatedPreview";
import AnimationsToggle from "@/components/AnimationsToggle";
import Toast from "@/components/Toast";
import {
  MenuBarSlot, useMenuBarSlot
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
  useOverflowing
} from "@/hooks/useOverflowing";
import {
  fuzzyFilter
} from "@/utils/fuzzySearch";
import {
  writePendingImport
} from "@/lib/pendingImportOptions";

const OTHER_SECTION = "__other__";
const GRID_CLASS =
  "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-4";

// Whether the expanded/collapsed state of each category survives reloads.
// Flip to false to make every category start as a carousel on each visit.
const PERSIST_EXPANDED = true;

function sectionId(
  engineId: string, category: string
) {
  return `${ engineId }::${ category }`;
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

interface SketchesListProps {
  sketches: Record<string, SketchItem[]>;
  engineLabels: Record<string, string>;
  activeEngine: string; // "all" | engine id
}

export default function SketchesList( {
  sketches,
  engineLabels,
  activeEngine
}: SketchesListProps ) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuBarSlot = useMenuBarSlot();

  const [
    view,
    setView
  ] = usePersistedViewMode<"grid" | "list">(
    "sketchbook:view-mode",
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
  const [
    categoryFilter,
    setCategoryFilter
  ] = useState<string>( searchParams.get( "category" ) || "" );

  // Keep category in sync with the URL so back/forward or external links
  // (e.g. the sketch breadcrumb opening /sketches/<engine>?category=...)
  // update the active filter without a full reload.
  useEffect(
    () => {
      setCategoryFilter( searchParams.get( "category" ) || "" );
    },
    [
      searchParams
    ]
  );

  // Per-category expansion state. By default every category renders as a
  // horizontal carousel (no ids open); expanding one swaps it to the full
  // grid. Persisted across visits unless PERSIST_EXPANDED is false.
  const {
    isOpen: isSectionExpanded,
    toggle: toggleSection
  } = usePersistedAccordion(
    "sketchbook:expanded-categories",
    () => [],
    PERSIST_EXPANDED
  );

  // While a search or category filter is active, every matching section is
  // shown as a full grid so all results are visible regardless of the
  // carousel/expanded state.
  const searchActive = search.trim().length > 0 || categoryFilter.length > 0;

  // Expand/collapse a category. No View Transition here: the cards stay
  // mounted across the toggle and CategorySection animates only the newly
  // revealed rows, so the already-visible row never moves or flickers.
  const handleToggleSection = toggleSection;

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

  // Build a `?keyword=…&category=…` suffix from the current filter state.
  const buildQuerySuffix = (
    keyword: string, category: string
  ) => {
    const params = new URLSearchParams();

    if ( category ) {
      params.set(
        "category",
        category
      );
    }

    if ( keyword ) {
      params.set(
        "keyword",
        keyword
      );
    }

    const qs = params.toString();

    return qs ? `?${ qs }` : "";
  };

  // Keep ?keyword= / ?category= in sync with the filter state.
  useEffect(
    () => {
      const basePath =
        currentEngine === "all" ? "/sketches" : `/sketches/${ currentEngine }`;

      router.replace(
        `${ basePath }${ buildQuerySuffix(
          search,
          categoryFilter
        ) }`,
        {
          scroll: false
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      search,
      categoryFilter
    ]
  );

  // Switch engine tab: animate via View Transitions API, sync the URL in the background
  const handleEngineClick = ( engineId: string ) => {
    runViewTransition( () => flushSync( () => setCurrentEngine( engineId ) ) );

    const basePath =
      engineId === "all" ? "/sketches" : `/sketches/${ engineId }`;

    router.push( `${ basePath }${ buildQuerySuffix(
      search,
      categoryFilter
    ) }` );
  };

  // "Import .json": read a previously-exported options.json, find the
  // sketch it belongs to (by its `name` field) and hard-navigate straight
  // to it, handing the parsed options off via sessionStorage so the fresh
  // sketch page can pre-fill its form (see SketchOptions.tsx).
  const importFileInputRef = useRef<HTMLInputElement>( null );
  const [
    importing,
    setImporting
  ] = useState( false );
  const [
    importToast,
    setImportToast
  ] = useState<{
    message: string;
    type: "success" | "error";
  } | null>( null );

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  // On narrow viewports the button is hidden from the tab row (no room) —
  // make it reachable from the global menu instead, for as long as this
  // page stays mounted.
  useEffect(
    () => {
      menuBarSlot?.registerImportHandler( handleImportClick );

      return () => menuBarSlot?.registerImportHandler( null );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      menuBarSlot?.registerImportHandler
    ]
  );

  const handleImportFileChange = async( event: React.ChangeEvent<HTMLInputElement> ) => {
    const file = event.target.files?.[ 0 ];

    if ( !file ) {
      return;
    }

    setImporting( true );

    try {
      const fileContent = await file.text();
      let parsed: unknown;

      try {
        parsed = JSON.parse( fileContent );
      } catch {
        throw new Error( "Invalid JSON file" );
      }

      const importedName =
        parsed && typeof parsed === "object" && typeof ( parsed as {
          name?: unknown;
        } ).name === "string"
          ? ( parsed as {
            name: string;
          } ).name.trim()
          : "";

      if ( !importedName ) {
        throw new Error( "This file doesn't look like an exported options.json (missing \"name\")" );
      }

      const matches = Object.values( sketches )
        .flat()
        .filter( ( t ) => t.name === importedName );

      if ( matches.length === 0 ) {
        throw new Error( `No sketch named "${ importedName }" found` );
      }

      // Disambiguate the rare case of a name shared across engines: prefer
      // the currently active engine tab, else fall back to the first match.
      let target = matches[ 0 ];

      if ( matches.length > 1 ) {
        const preferred = currentEngine !== "all"
          ? matches.find( ( t ) => sketches[ currentEngine ]?.includes( t ) )
          : undefined;

        target = preferred ?? matches[ 0 ];

        if ( !preferred ) {
          setImportToast( {
            message: `"${ importedName }" matches multiple engines — opening one of them`,
            type: "success"
          } );
        }
      }

      if ( !writePendingImport( parsed ) ) {
        setImportToast( {
          message: "Opened the sketch, but couldn't pre-fill options (storage unavailable). Please import manually on the sketch page.",
          type: "error"
        } );
      }

      window.location.assign( target.href );
    } catch( error ) {
      setImportToast( {
        message: error instanceof Error ? error.message : "Failed to import options",
        type: "error"
      } );
    } finally {
      setImporting( false );
      event.target.value = "";
    }
  };

  // Filter per engine: exact category match first (when active), then
  // fuzzy keyword over the remaining items.
  const filteredSketches = Object.entries( sketches ).reduce(
    (
      acc, [
        engineId,
        items
      ]
    ) => {
      const byCategory = categoryFilter
        ? items.filter( ( item ) => item.category === categoryFilter )
        : items;

      const filtered = fuzzyFilter(
        byCategory,
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
    {} as Record<string, SketchItem[]>
  );

  // Narrow to the selected engine tab (or keep all)
  const displayedSketches =
    currentEngine === "all"
      ? filteredSketches
      : Object.fromEntries( Object.entries( filteredSketches ).filter( ( [
        id
      ] ) => id === currentEngine ) );

  const totalCount = Object.values( displayedSketches ).reduce(
    (
      sum, items
    ) => sum + items.length,
    0
  );

  const engineOrder = Object.keys( sketches ).sort( (
    a, b
  ) => ( sketches[ b ]?.length ?? 0 ) - ( sketches[ a ]?.length ?? 0 ) );

  const totalAllCount = Object.values( sketches ).reduce(
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
              Sketches
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
              placeholder="Search sketches..."
              value={ search }
              onChange={ ( e ) => setSearch( e.target.value ) }
              className={ `pl-9 py-2 sm:pl-11 sm:py-2.5 rounded-lg sm:rounded-xl w-full bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-xs sm:text-sm placeholder:text-foreground/40 ${
                search
                  ? "pr-9 sm:pr-11"
                  : "pr-3 sm:pr-4"
              }` }
            />
            { search && (
              <button
                type="button"
                onClick={ () => setSearch( "" ) }
                aria-label="Clear search"
                title="Clear search"
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 sm:w-7 sm:h-7 rounded-md text-foreground/50 hover:text-foreground hover:bg-hover/50 transition-colors"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            ) }
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

        {/* Active filters — currently only the category chip */}
        { categoryFilter && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs text-foreground/50 font-medium">
              Filters:
            </span>
            <span className="inline-flex items-center gap-1 sm:gap-1.5 pl-2 pr-1 sm:pl-2.5 sm:pr-1.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-hover/60 border border-border text-xs sm:text-sm text-foreground">
              <span className="text-foreground/60">Category:</span>
              <span className="font-medium">{ categoryFilter }</span>
              <button
                type="button"
                onClick={ () => setCategoryFilter( "" ) }
                aria-label={ `Remove ${ categoryFilter } category filter` }
                title="Clear category filter"
                className="grid place-items-center w-4 h-4 sm:w-5 sm:h-5 rounded-md text-foreground/50 hover:text-foreground hover:bg-hover transition-colors"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </span>
          </div>
        ) }

        {/* Engine Tabs + Import */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-hide flex-1 min-w-0">
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
              const count = sketches[ engineId ]?.length || 0;
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

          <input
            ref={ importFileInputRef }
            type="file"
            accept=".json"
            onChange={ handleImportFileChange }
            className="hidden"
          />
          <button
            type="button"
            onClick={ handleImportClick }
            disabled={ importing }
            title="Import a previously exported options.json"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap bg-background border border-border text-foreground/60 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>
              { importing ? "Importing..." : "Import .json" }
            </span>
          </button>
        </div>
      </div>

      { importToast && (
        <Toast
          message={ importToast.message }
          type={ importToast.type }
          onClose={ () => setImportToast( null ) }
        />
      ) }

      {/* Sketches content — view-transition-name scopes the VT animation to this area only */}
      <div style={ {
        viewTransitionName: "sketches-list"
      } }>

        {/* Empty State */}
        { totalCount === 0 && (
          <div className="text-center py-8 sm:py-16">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-hover/50 mb-3 sm:mb-4">
              <Search className="w-6 h-6 sm:w-8 sm:h-8 text-foreground/40" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
              No sketches found
            </h3>
            <p className="text-xs sm:text-sm text-foreground/60">
              Try adjusting your search term
            </p>
          </div>
        ) }

        {/* Sketches grouped by engine */}
        { Object.entries( displayedSketches )
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
                      { items.length === 1 ? "sketch" : "sketches" }
                      { search && ` matching "${ search }"` }
                    </span>
                  </div>
                ) }

                {/* Categorized groups — each is a carousel that expands to a grid */}
                { Object.entries( groupedItems ).map( ( [
                  subCategory,
                  subItems
                ] ) => {
                  const id = sectionId(
                    engineId,
                    subCategory
                  );

                  return (
                    <CategorySection
                      key={ subCategory }
                      title={ subCategory }
                      count={ subItems.length }
                      expanded={ searchActive || isSectionExpanded( id ) }
                      forced={ searchActive }
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
                    <CategorySection
                      title={ `Other ${ label } sketches` }
                      count={ uncategorized.length }
                      expanded={ searchActive || isSectionExpanded( sectionId(
                        engineId,
                        OTHER_SECTION
                      ) ) }
                      forced={ searchActive }
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
                    // Still wrap in `category-cards` so its cards share the exact
                    // same inset (and shadow room) as every CategorySection row,
                    // keeping the left edge aligned across the whole gallery.
                    <div
                      className={
                        view === "grid"
                          ? `category-cards ${ GRID_CLASS }`
                          : "space-y-2 sm:space-y-3"
                      }
                    >
                      { uncategorized.map( (
                        {
                          href, name, thumbnail, preview, hasSketchForm, hiddenFromGallery
                        }, index
                      ) => (
                        <SketchCard
                          key={ name }
                          href={ href }
                          name={ name }
                          thumbnail={ thumbnail }
                          preview={ preview }
                          hasSketchForm={ hasSketchForm }
                          hiddenFromGallery={ hiddenFromGallery }
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

/**
 * A category block. Sketches render at full size with live previews, just
 * like the rest of the gallery. By default a grid-view category lays its cards
 * out in a single horizontal, scrollable row (showing as many as fit the
 * viewport — same column counts as the full grid) so the page stays short.
 * The square toggle next to the title expands the row into the full grid.
 *
 * List view ignores the carousel and always renders the full vertical stack,
 * since a horizontal row of list rows makes no sense.
 */
function CategorySection( {
  title,
  count,
  expanded,
  forced = false,
  onToggle,
  items,
  view,
  animationsEnabled
}: {
  title: string;
  count: number;
  expanded: boolean;
  // True when the expansion is forced by an active search rather than the
  // user. The toggle is hidden in that case — collapsing is a no-op while the
  // search keeps the section open, which would be a dead click.
  forced?: boolean;
  onToggle: () => void;
  items: SketchItem[];
  view: "grid" | "list";
  animationsEnabled?: boolean;
} ) {
  const isList = view === "list";
  const showGrid = expanded;

  // Measure whether the carousel row actually overflows on the current screen,
  // so the toggle + right-edge fade only appear when there's really something
  // to scroll to. Re-measures on resize and when the item count or mode change.
  // In grid mode there is no horizontal overflow, so `overflowing` is false;
  // we keep the toggle visible via `expanded` so the row can be collapsed back.
  const {
    ref: cardsRef,
    overflowing,
    atEnd
  } = useOverflowing<HTMLDivElement>( [
    items.length,
    view,
    showGrid
  ] );
  const canToggle = !isList && !forced && ( overflowing || expanded );
  // Fade the right edge only while there are cards hidden to the right; drop it
  // once scrolled to the end so it never lingers over empty space.
  const showRightFade = overflowing && !atEnd;

  // Animate the newly revealed rows only when the user expands (not on initial
  // mount, collapse, or a search-forced expand). The first row is kept still
  // by CSS, so visible cards never move.
  const [
    revealing,
    setRevealing
  ] = useState( false );
  const wasExpandedRef = useRef( expanded );

  useEffect(
    () => {
      const justExpanded = expanded && !wasExpandedRef.current;

      wasExpandedRef.current = expanded;

      if ( !justExpanded ) {
        return;
      }

      setRevealing( true );
      const timer = setTimeout(
        () => setRevealing( false ),
        360
      );

      return () => clearTimeout( timer );
    },
    [
      expanded
    ]
  );

  const cards = items.map( (
    item, index
  ) => (
    <SketchCard
      key={ item.name }
      href={ item.href }
      name={ item.name }
      thumbnail={ item.thumbnail }
      preview={ item.preview }
      hasSketchForm={ item.hasSketchForm }
      hiddenFromGallery={ item.hiddenFromGallery }
      view={ view }
      eager={ index === 0 }
      animationsEnabled={ animationsEnabled }
    />
  ) );

  return (
    <div>
      <div className="flex items-center gap-2 pl-2 sm:pl-4 mb-2 sm:mb-3">
        {/* Square toggle: expand the carousel into the full grid (or back).
            Only shown when the row actually overflows (or is already expanded),
            so it never appears as a dead control when everything already fits. */}
        { canToggle && (
          <button
            type="button"
            onClick={ onToggle }
            aria-expanded={ expanded }
            aria-label={ expanded ? `Collapse ${ title }` : `Show all ${ title } sketches` }
            title={ expanded ? "Collapse" : "Show all" }
            className="flex-shrink-0 grid place-items-center w-5 h-5 rounded-md border border-border text-foreground/50 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50 transition-colors"
          >
            <ChevronDown
              className={ `w-3 h-3 transition-transform duration-300 ease-out ${
                expanded ? "" : "-rotate-90"
              }` }
            />
          </button>
        ) }
        <h3 className="text-sm sm:text-base font-medium text-foreground/80">
          { title }
        </h3>
        <span className="text-xs text-foreground/60">
          { count }
        </span>
      </div>

      { isList ? (
        <div className="space-y-2 sm:space-y-3">
          { cards }
        </div>
      ) : (
        // One persistent container for both states: switching its class between
        // grid and carousel keeps the cards mounted (no video reload, the first
        // row stays put). `category-cards` reserves room so hover shadows aren't
        // clipped; `is-revealing` triggers the rise-in on expand only; the fade
        // is added only when the row truly overflows.
        <div
          ref={ cardsRef }
          className={
            showGrid
              ? `category-cards category-grid ${ GRID_CLASS }${ revealing ? " is-revealing" : "" }`
              : `category-cards category-carousel scrollbar-hide${ showRightFade ? " has-overflow" : "" }`
          }
        >
          { cards }
        </div>
      ) }
    </div>
  );
}

function SketchCard( {
  href,
  name,
  thumbnail,
  preview,
  hiddenFromGallery = false,
  view,
  eager = false,
  animationsEnabled
}: {
  href: string;
  name: string;
  thumbnail: string;
  preview: string | null;
  hasSketchForm: boolean;
  hiddenFromGallery?: boolean;
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
        className={ `group relative w-full bg-background rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-foreground/20 transition duration-300 hover:shadow-lg hover:shadow-active/10 hover:-translate-y-0.5 ${
          hiddenFromGallery ? "opacity-40 grayscale hover:opacity-100 hover:grayscale-0" : ""
        }` }
      >
        { hiddenFromGallery ? (
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

        {/* Sketch name */}
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
      className={ `group flex items-center gap-2 sm:gap-3 bg-background border border-border hover:border-foreground/20 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 hover:bg-hover/50 transition duration-300 hover:shadow-md hover:shadow-foreground/5 ${
        hiddenFromGallery ? "opacity-40 grayscale hover:opacity-100 hover:grayscale-0" : ""
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
            imgClassName="w-full h-full object-cover"
          />
        ) : (
          <Thumbnail
            src={ thumbnail }
            alt={ name }
            eager={ eager }
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
        ) }
      </div>

      <div className="flex-grow min-w-0 flex items-center gap-2">
        <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
          { name }
        </p>
        { hiddenFromGallery ? (
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
      data-pin-nopin="true"
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
