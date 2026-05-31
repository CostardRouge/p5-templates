"use client";

import {
  ChevronDown, Grid, List, Search
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
  useOverflowing
} from "@/hooks/useOverflowing";
import {
  fuzzyFilter
} from "@/utils/fuzzySearch";

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

  // Per-category expansion state. By default every category renders as a
  // horizontal carousel (no ids open); expanding one swaps it to the full
  // grid. Persisted across visits unless PERSIST_EXPANDED is false.
  const {
    isOpen: isSectionExpanded,
    toggle: toggleSection
  } = usePersistedAccordion(
    "templates-expanded-categories",
    () => [],
    PERSIST_EXPANDED
  );

  // While a search is active, every matching section is shown as a full grid
  // so all results are visible regardless of the carousel/expanded state.
  const searchActive = search.trim().length > 0;

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
                      title={ `Other ${ label } templates` }
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

/**
 * A category block. Templates render at full size with live previews, just
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
  items: TemplateItem[];
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
            aria-label={ expanded ? `Collapse ${ title }` : `Show all ${ title } templates` }
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
        className={ `group relative w-full bg-background rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-foreground/20 transition duration-300 hover:shadow-lg hover:shadow-active/10 hover:-translate-y-0.5 ${
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
      className={ `group flex items-center gap-2 sm:gap-3 bg-background border border-border hover:border-foreground/20 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 hover:bg-hover/50 transition duration-300 hover:shadow-md hover:shadow-foreground/5 ${
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
