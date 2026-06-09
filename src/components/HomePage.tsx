"use client";

import Link from "next/link";
import {
  useEffect, useMemo, useState
} from "react";
import {
  ArrowRight, Search, Shuffle, Sparkles
} from "lucide-react";
import HardLink from "@/components/HardLink";
import AnimatedPreview from "@/components/AnimatedPreview";
import {
  MenuBarSlot
} from "@/components/MenuBarPortal";
import {
  fuzzyFilter
} from "@/utils/fuzzySearch";
import type {
  TemplateItem
} from "@/app/templates/getTemplatesData";

type HomePageProps = {
  // Full searchable pool — everything the /templates gallery shows.
  templates: TemplateItem[];
  // Narrower pool for the latest/random showcase sections (excludes
  // `.hidden-home` templates).
  showcaseTemplates: TemplateItem[];
  engineLabels: Record<string, string>;
  totalTemplates: number;
};

const SHOWCASE_SIZE = 8;

const GRID_CLASS =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4";

function shuffle<T>( arr: T[] ): T[] {
  const out = arr.slice();

  for ( let i = out.length - 1; i > 0; i-- ) {
    const j = Math.floor( Math.random() * ( i + 1 ) );

    [
      out[ i ],
      out[ j ]
    ] = [
      out[ j ],
      out[ i ]
    ];
  }
  return out;
}

export default function HomePage( {
  templates,
  showcaseTemplates,
  engineLabels,
  totalTemplates
}: HomePageProps ) {
  const [
    search,
    setSearch
  ] = useState( "" );
  const [
    engine,
    setEngine
  ] = useState<string>( "all" );

  // Server render shows the first templates in registry order; the real
  // random picks are shuffled after mount so SSR and hydration match.
  const [
    randomPicks,
    setRandomPicks
  ] = useState<TemplateItem[]>( () => showcaseTemplates.slice(
    0,
    SHOWCASE_SIZE
  ) );

  const reshuffle = useMemo(
    () => () => {
      const withPreview = showcaseTemplates.filter( ( t ) => t.preview );
      const pool = withPreview.length >= SHOWCASE_SIZE
        ? withPreview
        : showcaseTemplates;

      setRandomPicks( shuffle( pool ).slice(
        0,
        SHOWCASE_SIZE
      ) );
    },
    [
      showcaseTemplates
    ]
  );

  useEffect(
    () => {
      reshuffle();
    },
    [
      reshuffle
    ]
  );

  const latest = useMemo(
    () => showcaseTemplates
      .slice()
      .sort( (
        a, b
      ) => b.ctime.localeCompare( a.ctime ) )
      .slice(
        0,
        SHOWCASE_SIZE
      ),
    [
      showcaseTemplates
    ]
  );

  // Engine ids ordered by template count, mirroring the gallery's tab order.
  const engineOrder = useMemo(
    () => {
      const counts: Record<string, number> = {};

      templates.forEach( ( t ) => {
        counts[ t.engine ] = ( counts[ t.engine ] ?? 0 ) + 1;
      } );

      return Object.entries( counts )
        .sort( (
          [
            , a
          ], [
            , b
          ]
        ) => b - a )
        .map( ( [
          id
        ] ) => id );
    },
    [
      templates
    ]
  );

  const searchActive = search.trim().length > 0 || engine !== "all";

  const results = useMemo(
    () => {
      const scoped =
        engine === "all"
          ? templates
          : templates.filter( ( t ) => t.engine === engine );

      return fuzzyFilter(
        scoped,
        search,
        ( item ) => [
          item.name,
          item.category || ""
        ]
      );
    },
    [
      templates,
      search,
      engine
    ]
  );

  return (
    <div className="p-3 sm:p-6 max-w-[1440px] mx-auto space-y-6 sm:space-y-10">
      {/* ============ HEADER ============ */}
      <header className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <MenuBarSlot />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">
            Coded templates
          </h1>
        </div>

        <p className="text-sm sm:text-base text-foreground/60 max-w-[60ch]">
          { totalTemplates } customizable templates built on p5.js, gsap, and
          html stages. Tweak parameters live, then export images or record
          video — right in the browser.
        </p>

        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground/40" />
          <input
            type="text"
            placeholder="Search templates..."
            value={ search }
            onChange={ ( e ) => setSearch( e.target.value ) }
            className="pl-9 pr-3 py-2 sm:pl-11 sm:pr-4 sm:py-2.5 rounded-lg sm:rounded-xl w-full bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-xs sm:text-sm placeholder:text-foreground/40"
          />
        </div>

        {/* Engine filter chips */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <EngineChip
            label="All engines"
            count={ templates.length }
            active={ engine === "all" }
            onClick={ () => setEngine( "all" ) }
          />
          { engineOrder.map( ( engineId ) => (
            <EngineChip
              key={ engineId }
              label={ engineLabels[ engineId ] || engineId }
              count={ templates.filter( ( t ) => t.engine === engineId ).length }
              active={ engine === engineId }
              onClick={ () => setEngine( engine === engineId ? "all" : engineId ) }
            />
          ) ) }
        </div>
      </header>

      { searchActive ? (
        /* ============ SEARCH RESULTS ============ */
        <section className="space-y-2 sm:space-y-4">
          <SectionHeader
            title="Results"
            count={ results.length }
          />

          { results.length === 0 ? (
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
          ) : (
            <div className={ GRID_CLASS }>
              { results.map( (
                template, index
              ) => (
                <TemplateCard
                  key={ `${ template.engine }-${ template.name }` }
                  template={ template }
                  eager={ index < 2 }
                />
              ) ) }
            </div>
          ) }
        </section>
      ) : (
        <>
          {/* ============ LATEST ============ */}
          <section className="space-y-2 sm:space-y-4">
            <SectionHeader
              title="Latest"
              count={ latest.length }
              icon={ <Sparkles className="w-4 h-4 text-foreground/50" /> }
            />
            <div className={ GRID_CLASS }>
              { latest.map( (
                template, index
              ) => (
                <TemplateCard
                  key={ `${ template.engine }-${ template.name }` }
                  template={ template }
                  eager={ index < 2 }
                />
              ) ) }
            </div>
          </section>

          {/* ============ RANDOM PICKS ============ */}
          <section className="space-y-2 sm:space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SectionHeader
                title="Random picks"
                count={ randomPicks.length }
              />
              <button
                type="button"
                onClick={ reshuffle }
                className="group flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium bg-background border border-border text-foreground/60 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50 transition-all duration-200 flex-shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                <span className="hidden sm:inline">Reshuffle</span>
              </button>
            </div>
            <div className={ GRID_CLASS }>
              { randomPicks.map( ( template ) => (
                <TemplateCard
                  key={ `${ template.engine }-${ template.name }` }
                  template={ template }
                />
              ) ) }
            </div>
          </section>

          {/* ============ BROWSE ALL ============ */}
          <section>
            <Link
              href="/templates"
              className="group flex items-center justify-center gap-2 w-full py-3 sm:py-4 rounded-lg sm:rounded-xl border border-border text-sm sm:text-base font-medium text-foreground/70 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50 transition-all duration-200"
            >
              <span>
                Browse all { totalTemplates } templates
              </span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </section>
        </>
      ) }
    </div>
  );
}

function SectionHeader( {
  title,
  count,
  icon
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
} ) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      { icon }
      <h2 className="text-base sm:text-lg font-semibold text-foreground">
        { title }
      </h2>
      <span className="text-xs sm:text-sm text-foreground/50 font-medium">
        { count } { count === 1 ? "template" : "templates" }
      </span>
    </div>
  );
}

function EngineChip( {
  label,
  count,
  active,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
} ) {
  return (
    <button
      onClick={ onClick }
      className={ `flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 flex-shrink-0 whitespace-nowrap ${
        active
          ? "bg-foreground text-background"
          : "bg-background border border-border text-foreground/60 hover:text-foreground hover:border-foreground/30 hover:bg-hover/50"
      }` }
    >
      { label }
      <span
        className={ `text-xs px-1.5 py-0.5 rounded-md font-mono ${
          active
            ? "bg-background/20 text-background/80"
            : "bg-hover text-foreground/50"
        }` }
      >
        { count }
      </span>
    </button>
  );
}

function TemplateCard( {
  template,
  eager = false
}: {
  template: TemplateItem;
  eager?: boolean;
} ) {
  return (
    <HardLink
      href={ template.href }
      className="group relative w-full bg-background rounded-xl sm:rounded-2xl overflow-hidden border border-border hover:border-foreground/20 transition duration-300 hover:shadow-lg hover:shadow-active/10 hover:-translate-y-0.5"
    >
      {/* Aspect ratio box for 4:5 (360x450) */}
      <div
        className="w-full relative"
        style={ {
          paddingTop: "125%"
        } }
      >
        { template.preview ? (
          <AnimatedPreview
            previewUrl={ template.preview }
            thumbnailUrl={ template.thumbnail }
            name={ template.name }
            eager={ eager }
            imgClassName="w-full h-full object-contain transition-transform duration-300"
          />
        ) : (
          <img
            alt={ template.name }
            src={ template.thumbnail }
            width={ 360 }
            height={ 450 }
            loading={ eager ? "eager" : "lazy" }
            fetchPriority={ eager ? "high" : undefined }
            decoding={ eager ? "sync" : "async" }
            className="absolute top-0 left-0 w-full h-full object-contain transition-transform duration-300"
          />
        ) }
      </div>

      <div className="bg-background border-t border-border px-1 py-2 overflow-hidden">
        <p
          title={ template.name }
          className="text-xs sm:text-sm font-medium text-foreground text-center whitespace-nowrap overflow-hidden text-ellipsis"
        >
          { template.name }
        </p>
      </div>
    </HardLink>
  );
}
