import type {
  Metadata
} from "next";
import Link from "next/link";

import {
  ENGINE_CATALOG
} from "@/engines/engineCatalog";
import {
  buildOgTitle, formatSketchTitle, getBaseUrl, SITE_NAME
} from "@/lib/seo";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd/BreadcrumbJsonLd";
import {
  filterSketchesForGallery,
  getSketchesData,
  type SketchItem
} from "../sketches/getSketchesData";

const TITLE = "Site map";
const DESCRIPTION =
  "Every page of Sketchbook in one list: the library, each engine, and every sketch grouped by series.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/sitemap"
  },
  openGraph: {
    title: buildOgTitle( TITLE ),
    description: DESCRIPTION,
    url: "/sitemap",
    siteName: SITE_NAME,
    type: "website"
  }
};

/**
 * The human-readable counterpart of `app/sitemap.ts` (which is the machine one,
 * served at `/sitemap.xml`). Next resolves the two independently: the metadata
 * file owns `/sitemap.xml`, this route owns `/sitemap`.
 *
 * A **server** component: every sketch is an anchor in the first HTML response,
 * which is the whole point — it is one crawlable page reaching all ~300 sketch
 * routes, and the only place a reader can see the shape of the site without
 * working the gallery's filters.
 *
 * Sketch links are `prefetch={ false }` on purpose. A `next/link` prefetches
 * once it enters the viewport, and this page puts three hundred of them there
 * a screenful at a time; each one would pull a sketch route's payload for a
 * link the reader is scrolling past. The handful of navigation links above them
 * keep the default.
 *
 * Sketches are listed under the same rules as the gallery
 * (`filterSketchesForGallery`): in production the `.hidden-template` ones are
 * dropped, in development they stay so a new sketch shows up here immediately.
 */

const SECTION_TITLE_CLASS =
  "font-mono text-[11px] uppercase tracking-[0.2em] text-label";

// Dense multi-column list: 300 entries in one column would be a page of
// scrolling. Three columns and not four — at four, a name like "Animated Text
// Points V10 Asterisk" no longer fits, and a truncated entry defeats the point
// of a list whose whole job is telling near-identical variants apart. Long
// names wrap instead.
const LINK_GRID =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1";

const LINK_CLASS =
  "block rounded px-1 py-0.5 text-sm text-foreground/80 hover:text-foreground hover:bg-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 transition-colors";

type CategoryGroup = {
  /** `null` for sketches that sit directly under their engine. */
  category: string | null;
  sketches: SketchItem[];
};

/**
 * Groups an engine's sketches by their series directory, alphabetically, with
 * the uncategorised ones last — they read as an appendix rather than as the
 * first thing on the page.
 */
function groupByCategory( sketches: SketchItem[] ): CategoryGroup[] {
  const groups = new Map<string, SketchItem[]>();

  for ( const sketch of sketches ) {
    const key = sketch.category ?? "";

    const bucket = groups.get( key );

    if ( bucket ) {
      bucket.push( sketch );
    } else {
      groups.set(
        key,
        [
          sketch
        ]
      );
    }
  }

  return [
    ...groups.entries()
  ]
    .sort( (
      [
        a
      ], [
        b
      ]
    ) => {
      if ( a === "" ) {
        return 1;
      }
      if ( b === "" ) {
        return -1;
      }
      return a.localeCompare( b );
    } )
    .map( ( [
      category,
      items
    ] ) => ( {
      category: category === "" ? null : category,
      sketches: items.slice().sort( (
        a, b
      ) => a.name.localeCompare( b.name ) )
    } ) );
}

function SketchLinks( {
  sketches
}: {
  sketches: SketchItem[];
} ) {
  return (
    <ul className={ LINK_GRID }>
      { sketches.map( ( sketch ) => (
        <li key={ sketch.href }>
          <Link
            href={ sketch.href }
            prefetch={ false }
            className={ LINK_CLASS }
          >
            { formatSketchTitle( sketch.name ) }
          </Link>
        </li>
      ) ) }
    </ul>
  );
}

export default async function SiteMapPage() {
  const {
    sketchesByEngine
  } = await getSketchesData();
  const baseUrl = getBaseUrl();

  const visibleByEngine = filterSketchesForGallery( sketchesByEngine );

  // Only the engines that actually have a sketch, in catalogue order (p5 first,
  // which is also the order the gallery's tabs use).
  const engines = ENGINE_CATALOG
    .map( ( engine ) => ( {
      ...engine,
      groups: groupByCategory( visibleByEngine[ engine.id ] ?? [] ),
      count: ( visibleByEngine[ engine.id ] ?? [] ).length
    } ) )
    .filter( ( engine ) => engine.count > 0 );

  const total = engines.reduce(
    (
      sum, engine
    ) => sum + engine.count,
    0
  );

  // `/recordings` exists only when the backend recording queue is enabled — the
  // same flag that decides whether the menu bar shows it.
  const showRecordings = process.env.BACKEND_RECORDING === "true";

  const breadcrumbItems = [
    {
      name: "Home",
      url: baseUrl
    },
    {
      name: TITLE,
      url: `${ baseUrl }/sitemap`
    }
  ];

  return (
    <div className="p-3 sm:p-6">
      <BreadcrumbJsonLd items={ breadcrumbItems } />

      {/* The menu-bar button is fixed at the top-left corner of the viewport
          (`MenuBar`, `top-2 left-2`), so the heading needs to start below it —
          at the default padding it sits under the button on a phone. */ }
      <div className="mx-auto w-full max-w-5xl flex flex-col gap-10 sm:gap-14 pt-14 pb-6 sm:py-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
            { TITLE }
          </h1>
          <p className="max-w-[60ch] text-sm sm:text-base text-label leading-relaxed">
            Every page of { SITE_NAME }, in one list —{ " " }
            <span className="font-mono tabular-nums text-foreground">
              { total }
            </span>{ " " }
            sketches across{ " " }
            <span className="font-mono tabular-nums text-foreground">
              { engines.length }
            </span>{ " " }
            rendering engines.
          </p>
          <p className="text-xs text-label">
            {/* Neither is an app route, so they are plain anchors: a
                client-side `next/link` to a metadata file would try to
                render it as a page. */ }
            Machine-readable:{ " " }
            <a
              href="/sitemap.xml"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              sitemap.xml
            </a>{ " · " }
            <a
              href="/robots.txt"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              robots.txt
            </a>
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className={ SECTION_TITLE_CLASS }>Pages</h2>
          <ul className={ LINK_GRID }>
            <li>
              <Link href="/" className={ LINK_CLASS }>
                Home
              </Link>
            </li>
            <li>
              <Link href="/sketches" className={ LINK_CLASS }>
                Sketch library
              </Link>
            </li>
            <li>
              <Link href="/sitemap" className={ LINK_CLASS }>
                Site map
              </Link>
            </li>
            { showRecordings && (
              <li>
                <Link href="/recordings" className={ LINK_CLASS }>
                  Recordings
                </Link>
              </li>
            ) }
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={ SECTION_TITLE_CLASS }>Engines</h2>
          <ul className={ LINK_GRID }>
            { engines.map( ( engine ) => (
              <li key={ engine.id }>
                <Link
                  href={ `/sketches/${ engine.id }` }
                  className={ LINK_CLASS }
                >
                  { engine.label } sketches ({ engine.count })
                </Link>
              </li>
            ) ) }
          </ul>
        </section>

        { engines.map( ( engine ) => (
          <section
            key={ engine.id }
            id={ engine.id }
            className="flex flex-col gap-6 scroll-mt-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-6">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                { engine.label }
              </h2>
              <Link
                href={ `/sketches/${ engine.id }` }
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-label hover:text-foreground transition-colors"
              >
                { engine.count } sketches →
              </Link>
            </div>

            { engine.groups.map( ( group ) => (
              <div
                key={ group.category ?? "__uncategorised" }
                className="flex flex-col gap-2"
              >
                <h3 className={ SECTION_TITLE_CLASS }>
                  { group.category ?? "Standalone" }
                </h3>
                <SketchLinks sketches={ group.sketches } />
              </div>
            ) ) }
          </section>
        ) ) }
      </div>
    </div>
  );
}
